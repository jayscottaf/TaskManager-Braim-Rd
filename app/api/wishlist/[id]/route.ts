import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { updateWishListItem, deleteWishListItem } from "@/lib/wishlist";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    await updateWishListItem(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Wish list PATCH error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to update: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    await deleteWishListItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Wish list DELETE error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to delete: ${msg}` }, { status: 500 });
  }
}
