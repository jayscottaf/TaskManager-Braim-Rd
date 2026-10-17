"use client";

import Image from "next/image";
import { useState } from "react";
import { isAllowedImageUrl } from "@/lib/image-policy";

type TaskImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  loading?: "lazy" | "eager";
};

function knownRemoteImage(src: string) {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/i.test(url.hostname) ||
        ["prod-files-secure.s3.us-west-2.amazonaws.com", "s3.us-west-2.amazonaws.com", "s3-us-west-2.amazonaws.com", "secure.notion-static.com"].includes(url.hostname));
  } catch { return false; }
}

/** Optimize our Blob store. Known legacy Notion/Blob URLs display directly. */
export function TaskImage({ src, alt, className, fill, width, height, sizes, onClick, loading = "lazy" }: TaskImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const localPreview = src.startsWith("blob:") || /^data:image\/(jpeg|png|webp|gif);base64,/i.test(src);
  const localImage = src.startsWith("/") && !src.startsWith("//");
  if (localPreview) {
    // Browser-owned previews never pass through the server image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} width={width} height={height} onClick={onClick} loading={loading} decoding="async" style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : undefined} />;
  }
  if (!localImage && !knownRemoteImage(src)) {
    return <span role="img" aria-label={alt} className={className}>Photo unavailable</span>;
  }
  const optimized = localImage || isAllowedImageUrl(src, process.env.NEXT_PUBLIC_IMAGE_HOST);
  return <Image src={src} alt={alt} fill={fill} width={fill ? undefined : width || 640} height={fill ? undefined : height || 480}
    sizes={sizes || (fill ? "100vw" : "640px")} className={className} loading={loading} onClick={onClick}
    unoptimized={!optimized || failedSource === src} onError={() => setFailedSource(src)} />;
}
