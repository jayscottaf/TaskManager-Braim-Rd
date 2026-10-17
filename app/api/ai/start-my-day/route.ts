import { NextRequest, NextResponse } from "next/server";
import { startMyDay } from "@/lib/ai";
import { getTasks } from "@/lib/notion";
import { checkAuth } from "@/lib/auth";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const rawMinutes = request.nextUrl.searchParams.get("minutes");
    const minutes = rawMinutes == null ? 30 : Number(rawMinutes);
    if (!Number.isFinite(minutes) || minutes < 10 || minutes > 480) {
      return NextResponse.json(
        { error: "Minutes must be a number between 10 and 480" },
        { status: 400 },
      );
    }

    const budgetMinutes = Math.round(minutes);
    const tasks = await getTasks({ excludeCompleted: true });
    const focus = await startMyDay(tasks, budgetMinutes);

    return NextResponse.json(focus);
  } catch (error) {
    console.error("Start My Day error:", error);
    return NextResponse.json(
      { error: "Failed to generate daily focus" },
      { status: 500 },
    );
  }
}
