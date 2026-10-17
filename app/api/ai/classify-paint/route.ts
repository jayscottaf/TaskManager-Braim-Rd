import { NextRequest, NextResponse } from "next/server";
import { classifyPaintLabel } from "@/lib/ai";
import { checkAuth } from "@/lib/auth";
import { analysisImage, ImageInputError, imageFromForm, imageRequestData } from "@/lib/image-server";

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const form = await imageRequestData(request);
    const image = await analysisImage(await imageFromForm(form), true);
    return NextResponse.json(await classifyPaintLabel(image.base64, image.mediaType));
  } catch (error) {
    if (error instanceof ImageInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Paint label scan error:", error);
    return NextResponse.json({ error: "Label could not be read. Your photo is attached; retry or enter details yourself." }, { status: 500 });
  }
}
