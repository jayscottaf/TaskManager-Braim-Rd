import { NextRequest, NextResponse } from "next/server";
import { startMyDay } from "@/lib/ai";
import { getTasks } from "@/lib/notion";
import { checkAuth } from "@/lib/auth";
import { getCached, setCache } from "@/lib/cache";
import type { DailyFocus } from "@/lib/ai";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `start-my-day:${today}`;
    const cached = getCached<DailyFocus>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const tasks = await getTasks({ excludeCompleted: true });
    const focus = await startMyDay(tasks);

    setCache(cacheKey, focus, 60 * 60 * 1000);
    return NextResponse.json(focus);
  } catch (error) {
    console.error("Start My Day error:", error);
    return NextResponse.json(
      { error: "Failed to generate daily focus" },
      { status: 500 }
    );
  }
}
