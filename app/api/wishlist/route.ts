import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { getWishListItems, createWishListItem } from "@/lib/wishlist";

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const showArchived = request.nextUrl.searchParams.get("archived") === "true";
    const items = await getWishListItems(showArchived);
    return NextResponse.json(items);
  } catch (error) {
    console.error("Wish list GET error:", error);
    return NextResponse.json({ error: "Failed to fetch wish list" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    if (!body.project?.trim()) {
      return NextResponse.json({ error: "Project name required" }, { status: 400 });
    }

    const id = await createWishListItem(body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Wish list POST error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create item: ${msg}` }, { status: 500 });
  }
}
