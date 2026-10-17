// Leave space for multipart headers under Vercel's 4.5 MB request limit.
export const MAX_IMAGE_BYTES = 3_800_000;
export const MAX_IMAGE_REQUEST_BYTES = 4_300_000;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ImageMediaType = (typeof IMAGE_TYPES)[number];

export function imageDimensions(width: number, height: number, maxEdge: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || maxEdge < 1) {
    throw new Error("Invalid image dimensions");
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Derive the exact store host; never expose the token to the browser. */
export function blobImageHost(token?: string, configuredHost?: string): string | undefined {
  if (configuredHost && /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/i.test(configuredHost)) {
    return configuredHost.toLowerCase();
  }
  const store = token?.match(/^vercel_blob_rw_([a-z0-9]+)_/i)?.[1];
  return store ? `${store.toLowerCase()}.public.blob.vercel-storage.com` : undefined;
}

export function isAllowedImageUrl(value: string, hostname?: string): boolean {
  try {
    const url = new URL(value);
    return !!hostname && url.protocol === "https:" && url.hostname === hostname && !url.port &&
      !url.username && !url.password && !url.search && !url.hash &&
      (url.pathname.startsWith("/photos/") || url.pathname.startsWith("/paint-labels/"));
  } catch {
    return false;
  }
}
