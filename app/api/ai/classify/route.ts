import { NextRequest, NextResponse } from "next/server";
import { classifyPhoto } from "@/lib/ai";
import { checkAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const mediaType = file.type as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "image/gif";

    const classification = await classifyPhoto(base64, mediaType);
    return NextResponse.json(classification);
  } catch (error) {
    console.error("AI classify error:", error);
    return NextResponse.json(
      { error: "Photo classification failed" },
      { status: 500 }
    );
  }
}
