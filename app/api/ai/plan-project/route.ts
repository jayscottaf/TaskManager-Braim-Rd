import { NextRequest, NextResponse } from "next/server";
import { planWishListProject } from "@/lib/ai";
import { checkAuth } from "@/lib/auth";
import { analysisImage, ImageInputError, imageFromForm, imageRequestData } from "@/lib/image-server";

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const form = await imageRequestData(request);
    const description = String(form.get("description") || "").trim();
    if (!description || description.length > 10_000) throw new ImageInputError("Enter a project description under 10,000 characters");
    const image = form.has("image") || form.has("imageUrl") ? await analysisImage(await imageFromForm(form)) : undefined;
    return NextResponse.json(await planWishListProject(description, image?.base64, image?.mediaType));
  } catch (error) {
    if (error instanceof ImageInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Plan project error:", error);
    return NextResponse.json({ error: "Could not plan this project. Your photos are kept here; please try again." }, { status: 500 });
  }
}
