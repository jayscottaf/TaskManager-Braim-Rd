import type { PaintLabelScan, PhotoClassification } from "./ai";
import { imageDimensions, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from "./image-policy";

export interface ImageUploadResult {
  url: string;
  classification?: PhotoClassification | PaintLabelScan;
  analysisError?: string;
}

export type ImageUploadOptions = { analysis?: "task" | "paint"; context?: string };

// A shared queue bounds memory use when a gallery selection contains many iPhone photos.
let active = 0;
const waiting: Array<() => void> = [];
async function withImageSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  else active += 1;
  try { return await work(); }
  finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}

function authHeaders(): Record<string, string> {
  const secret = process.env.NEXT_PUBLIC_APP_SECRET;
  return secret ? { "x-app-secret": secret } : {};
}

async function responseError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return new Error(data?.error || (response.status === 413 ? "Photo is too large. Try a smaller image." : fallback));
}

/** One decode and canvas; never enlarge a small photo. Labels retain extra detail. */
async function prepareImage(file: File, paintLabel: boolean): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 30_000_000) throw new Error("Choose a photo smaller than 30 MB.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be opened. Try a JPEG or another photo."));
      image.src = url;
    });
    if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
      throw new Error("This image is too large to process. Choose a smaller photo.");
    }
    const dimensions = imageDimensions(image.naturalWidth, image.naturalHeight, paintLabel ? 2560 : 2048);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable. Please try again.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare photo.")), "image/jpeg", quality);
    });
    let blob = await encode(paintLabel ? 0.92 : 0.85);
    if (blob.size > MAX_IMAGE_BYTES) blob = await encode(0.75);
    if (blob.size > MAX_IMAGE_BYTES) throw new Error("Photo is too detailed to upload. Try a smaller image.");
    canvas.width = 0;
    canvas.height = 0;
    return new File([blob], `${file.name.replace(/\.[^.]*$/, "") || "photo"}.jpg`, { type: "image/jpeg" });
  } finally {
    image.src = "";
    URL.revokeObjectURL(url);
  }
}

export async function uploadImage(file: File, options: ImageUploadOptions = {}): Promise<ImageUploadResult> {
  return withImageSlot(async () => {
    const resized = await prepareImage(file, options.analysis === "paint");
    const form = new FormData();
    form.append("image", resized);
    if (options.analysis) form.append("analysis", options.analysis);
    if (options.context?.trim()) form.append("context", options.context.trim().slice(0, 2000));
    const response = await fetch("/api/upload", { method: "POST", headers: authHeaders(), body: form });
    if (!response.ok) throw await responseError(response, "Photo did not upload. Please try again.");
    const result: ImageUploadResult = await response.json();
    if (!result.url) throw new Error("Photo did not upload. Please try again.");
    return result;
  });
}

/** Retry analysis without decoding, resizing, or uploading the successful photo again. */
export async function analyzeUploadedImage(url: string, analysis: "task" | "paint", context?: string) {
  const response = await fetch(`/api/ai/${analysis === "paint" ? "classify-paint" : "classify"}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl: url, context: context?.trim().slice(0, 2000) }),
  });
  if (!response.ok) throw await responseError(response, "Photo is saved, but analysis failed. You can retry or enter details yourself.");
  return response.json() as Promise<PhotoClassification | PaintLabelScan>;
}
