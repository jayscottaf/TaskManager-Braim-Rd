import { NextRequest, NextResponse } from "next/server";
import { classifyPhoto } from "@/lib/ai";
import { checkAuth } from "@/lib/auth";
import { analysisImage, ImageInputError, imageFromForm, imageRequestData } from "@/lib/image-server";

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const form = await imageRequestData(request);
    const image = await analysisImage(await imageFromForm(form));
    return NextResponse.json(await classifyPhoto(image.base64, image.mediaType, String(form.get("context") || "").slice(0, 2000)));
  } catch (error) {
    if (error instanceof ImageInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("AI classify error:", error);
    return NextResponse.json({ error: "Photo is attached, but suggestions could not be generated. Please try again." }, { status: 500 });
  }
}
