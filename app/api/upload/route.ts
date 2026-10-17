import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { checkAuth } from "@/lib/auth";
import { classifyPaintLabel, classifyPhoto } from "@/lib/ai";
import { analysisImage, ImageInputError, imageRequestData, uploadedImage } from "@/lib/image-server";

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const form = await imageRequestData(request);
    const file = form.get("image");
    const image = await uploadedImage(file);
    const analysis = form.get("analysis");
    if (analysis && analysis !== "task" && analysis !== "paint") throw new ImageInputError("Unknown photo analysis");
    const context = String(form.get("context") || "").slice(0, 2000);
    const safeName = (file as File).name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "photo.jpg";
    const blob = await put(`photos/${safeName}`, image.buffer, {
      access: "public", addRandomSuffix: true, contentType: image.mediaType,
    });
    if (analysis) {
      try {
        // Reuse the validated buffer; no second browser upload or Blob download.
        const prepared = await analysisImage(image, analysis === "paint");
        const classification = analysis === "paint"
          ? await classifyPaintLabel(prepared.base64, prepared.mediaType)
          : await classifyPhoto(prepared.base64, prepared.mediaType, context);
        return NextResponse.json({ url: blob.url, classification });
      } catch (error) {
        console.error("Uploaded photo analysis failed:", error);
        return NextResponse.json({ url: blob.url, analysisError: "Photo attached. Suggestions are unavailable; retry or enter the details yourself." });
      }
    }
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    if (error instanceof ImageInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Photo did not upload. Please try again." }, { status: 500 });
  }
}
