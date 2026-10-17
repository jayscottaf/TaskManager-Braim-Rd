import type { NextConfig } from "next";
import { blobImageHost, MAX_IMAGE_BYTES } from "./lib/image-policy";

const imageHost = blobImageHost(process.env.BLOB_READ_WRITE_TOKEN, process.env.BLOB_PUBLIC_HOST);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_IMAGE_HOST: imageHost || "" },
  images: {
    remotePatterns: imageHost ? [
      { protocol: "https", hostname: imageHost, port: "", pathname: "/photos/**", search: "" },
      { protocol: "https", hostname: imageHost, port: "", pathname: "/paint-labels/**", search: "" },
    ] : [],
    maximumRedirects: 0,
    maximumResponseBody: MAX_IMAGE_BYTES,
  },
};

export default nextConfig;
