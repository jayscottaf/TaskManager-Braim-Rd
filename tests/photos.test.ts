import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { blobImageHost, imageDimensions, isAllowedImageUrl, MAX_IMAGE_BYTES, MAX_IMAGE_REQUEST_BYTES } from "../lib/image-policy";
import { analysisImage, imageFromForm, imageRequestData, uploadedImage } from "../lib/image-server";

const mocks = vi.hoisted(() => ({ put: vi.fn(), classify: vi.fn(), paint: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/lib/ai", () => ({ classifyPhoto: mocks.classify, classifyPaintLabel: mocks.paint }));
import { POST as upload } from "../app/api/upload/route";

const host = "store123.public.blob.vercel-storage.com";

async function jpeg(width = 100, height = 80) {
  const bytes = await sharp({ create: { width, height, channels: 3, background: "#8ad2bd" } }).jpeg().toBuffer();
  return new File([new Uint8Array(bytes)], "photo.jpg", { type: "image/jpeg" });
}

beforeEach(() => {
  vi.stubEnv("APP_SECRET", "");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_store123_test");
  vi.stubEnv("BLOB_PUBLIC_HOST", "");
  mocks.put.mockReset().mockResolvedValue({ url: `https://${host}/photos/photo-123.jpg` });
  mocks.classify.mockReset();
  mocks.paint.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("photo processing", () => {
  it("bounds dimensions without upscaling small or narrow photos", () => {
    expect(imageDimensions(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(imageDimensions(120, 80, 2048)).toEqual({ width: 120, height: 80 });
    expect(imageDimensions(1, 4000, 2048)).toEqual({ width: 1, height: 2048 });
    expect(() => imageDimensions(0, 200, 2048)).toThrow();
  });

  it("rejects claimed image files with invalid bytes, incorrect types, and oversized files", async () => {
    await expect(uploadedImage(new File(["not an image"], "fake.jpg", { type: "image/jpeg" }))).rejects.toThrow("not a supported photo");
    await expect(uploadedImage(new File(["<svg/>"], "photo.svg", { type: "image/svg+xml" }))).rejects.toThrow("JPEG");
    await expect(uploadedImage(new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "large.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ status: 413 });
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
    await expect(uploadedImage(new File([new Uint8Array(png)], "mislabeled.jpg", { type: "image/jpeg" }))).rejects.toThrow("not a supported photo");
  });

  it("retains label detail while reducing task AI dimensions and never enlarging", async () => {
    const large = await uploadedImage(await jpeg(2400, 1800));
    const task = await analysisImage(large);
    const paint = await analysisImage(large, true);
    expect(await sharp(Buffer.from(task.base64, "base64")).metadata()).toMatchObject({ width: 1280, height: 960 });
    expect(await sharp(Buffer.from(paint.base64, "base64")).metadata()).toMatchObject({ width: 2400, height: 1800 });
    const small = await analysisImage(await uploadedImage(await jpeg()));
    expect(await sharp(Buffer.from(small.base64, "base64")).metadata()).toMatchObject({ width: 100, height: 80 });
  });

  it("caps request bodies before multipart parsing including requests without content-length", async () => {
    const request = new Request("http://localhost/api/upload", {
      method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=test" }, body: new Uint8Array(MAX_IMAGE_REQUEST_BYTES + 1),
    });
    await expect(imageRequestData(request)).rejects.toMatchObject({ status: 413 });
  });
});

describe("uploaded photo analysis", () => {
  it("restricts retry downloads to this Blob store and our image paths", async () => {
    expect(blobImageHost("vercel_blob_rw_Store123_secret")).toBe(host);
    expect(blobImageHost(undefined, "localhost")).toBeUndefined();
    expect(isAllowedImageUrl(`https://${host}/photos/photo.jpg`, host)).toBe(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const url of ["http://127.0.0.1/photo.jpg", "https://example.com/photo.jpg", `https://${host}.evil.example/photos/x.jpg`,
      `https://other.public.blob.vercel-storage.com/photos/x.jpg`, `https://${host}/unknown/photo.jpg`, `https://${host}/photos/x.jpg?redirect=elsewhere`, `https://user:pass@${host}/photos/x.jpg`]) {
      const form = new FormData(); form.set("imageUrl", url);
      await expect(imageFromForm(form)).rejects.toThrow("uploaded to this app");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads a previously uploaded photo without following redirects", async () => {
    const file = await jpeg();
    const fetchMock = vi.fn().mockResolvedValue(new Response(await file.arrayBuffer(), { headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData(); form.set("imageUrl", `https://${host}/photos/photo.jpg`);
    expect(await imageFromForm(form)).toMatchObject({ mediaType: "image/jpeg" });
    expect(fetchMock).toHaveBeenCalledWith(`https://${host}/photos/photo.jpg`, expect.objectContaining({ redirect: "error" }));
  });

  it("returns the successfully uploaded photo when AI fails and uploads once", async () => {
    mocks.classify.mockRejectedValue(new Error("AI unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const form = new FormData(); form.set("image", await jpeg()); form.set("analysis", "task");
    const response = await upload(new NextRequest("http://localhost/api/upload", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ url: `https://${host}/photos/photo-123.jpg`, analysisError: expect.any(String) });
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.classify).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("classifies the uploaded buffer without a second download", async () => {
    mocks.classify.mockResolvedValue({ task: "Paint porch" });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const form = new FormData(); form.set("image", await jpeg()); form.set("analysis", "task"); form.set("context", "Roof already repaired");
    const response = await upload(new NextRequest("http://localhost/api/upload", { method: "POST", body: form }));
    expect(await response.json()).toMatchObject({ classification: { task: "Paint porch" } });
    expect(mocks.classify).toHaveBeenCalledWith(expect.any(String), "image/jpeg", "Roof already repaired");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
