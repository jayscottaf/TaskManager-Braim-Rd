import { NextRequest, NextResponse } from "next/server";
import { planWishListProject } from "@/lib/ai";
import { checkAuth } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const description = formData.get("description") as string;
    const file = formData.get("image") as File | null;

    if (!description?.trim()) {
      return NextResponse.json({ error: "Description required" }, { status: 400 });
    }

    let imageBase64: string | undefined;
    let mediaType: string | undefined;

    if (file) {
      const bytes = await file.arrayBuffer();
      imageBase64 = Buffer.from(bytes).toString("base64");
      mediaType = file.type;
    }

    const plan = await planWishListProject(description, imageBase64, mediaType);
    return NextResponse.json(plan);
  } catch (error) {
    console.error("Plan project error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to plan project: ${msg}` },
      { status: 500 }
    );
  }
}
