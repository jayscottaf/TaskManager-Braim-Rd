import sharp from "sharp";
import { blobImageHost, IMAGE_TYPES, isAllowedImageUrl, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, MAX_IMAGE_REQUEST_BYTES, type ImageMediaType } from "./image-policy";

export class ImageInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function limitedBytes(stream: ReadableStream<Uint8Array> | null, max: number): Promise<Buffer> {
  if (!stream) throw new ImageInputError("No image provided");
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new ImageInputError("Photo is too large. Choose a smaller image.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function imageRequestData(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") || "";
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_REQUEST_BYTES) {
    throw new ImageInputError("Photo is too large. Choose a smaller image.", 413);
  }
  const bytes = await limitedBytes(request.body, contentType.startsWith("application/json") ? 16_000 : MAX_IMAGE_REQUEST_BYTES);
  if (contentType.startsWith("application/json")) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(bytes.toString("utf8"));
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid request");
    } catch { throw new ImageInputError("Could not read image request"); }
    const form = new FormData();
    for (const key of ["imageUrl", "context", "description"]) {
      if (typeof data[key] === "string") form.set(key, data[key]);
    }
    return form;
  }
  if (!contentType.startsWith("multipart/form-data")) throw new ImageInputError("An image upload is required");
  try {
    return await new Response(new Uint8Array(bytes), { headers: { "content-type": contentType } }).formData();
  } catch { throw new ImageInputError("Could not read image upload"); }
}

async function validateImage(buffer: Buffer, type: string) {
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) throw new ImageInputError("Choose a JPEG, PNG, WebP, or GIF photo");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new ImageInputError("Photo is too large. Choose a smaller image.", 413);
  try {
    const metadata = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false }).metadata();
    const formatTypes: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    if (!metadata.width || !metadata.height || formatTypes[metadata.format || ""] !== type ||
      metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw new Error("Invalid image");
  } catch { throw new ImageInputError("The file is not a supported photo or its dimensions are too large"); }
  return { buffer, mediaType: type as ImageMediaType };
}

export async function uploadedImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) throw new ImageInputError("No image provided");
  // Reject type and size before copying the file into a buffer.
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) throw new ImageInputError("Choose a JPEG, PNG, WebP, or GIF photo");
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new ImageInputError("Photo is too large. Choose a smaller image.", 413);
  return validateImage(Buffer.from(await file.arrayBuffer()), file.type);
}

export async function imageFromForm(form: FormData) {
  const file = form.get("image");
  if (file instanceof File) return uploadedImage(file);
  const url = form.get("imageUrl");
  const host = blobImageHost(process.env.BLOB_READ_WRITE_TOKEN, process.env.BLOB_PUBLIC_HOST);
  if (typeof url !== "string" || !isAllowedImageUrl(url, host)) throw new ImageInputError("Choose a photo uploaded to this app");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!response.ok) throw new ImageInputError("Could not load the saved photo. Try again.");
  const type = response.headers.get("content-type")?.split(";")[0] || "";
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) throw new ImageInputError("Saved file is not a supported photo");
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new ImageInputError("Saved photo is too large", 413);
  return validateImage(await limitedBytes(response.body, MAX_IMAGE_BYTES), type);
}

export async function analysisImage(image: { buffer: Buffer }, paintLabel = false) {
  const buffer = await sharp(image.buffer, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false })
    .rotate().resize({ width: paintLabel ? 2560 : 1280, height: paintLabel ? 2560 : 1280, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }).jpeg({ quality: paintLabel ? 92 : 80 }).toBuffer();
  return { base64: buffer.toString("base64"), mediaType: "image/jpeg" as const };
}
