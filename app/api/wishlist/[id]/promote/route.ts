import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { promoteWishListItem } from "@/lib/wishlist";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    const body = await request.json();
    const date = body.date;
    const validDay = (value: unknown) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    if (date && (!validDay(date.start) || (date.end && (!validDay(date.end) || date.end < date.start)))) {
      return NextResponse.json({ error: "Choose a valid planned date or leave it blank" }, { status: 400 });
    }
    return NextResponse.json(await promoteWishListItem(id, date));
  } catch (error) {
    console.error("Wishlist promotion failed:", error);
    return NextResponse.json({ error: "Couldn't finish moving this idea. Your idea is saved; retry safely to finish." }, { status: 500 });
  }
}
