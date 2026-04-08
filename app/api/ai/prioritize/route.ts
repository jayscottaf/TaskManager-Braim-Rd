import { NextRequest, NextResponse } from "next/server";
import { getTasks } from "@/lib/notion";
import { prioritizeTasks } from "@/lib/ai";
import { checkAuth } from "@/lib/auth";
import { getCached, setCache, CACHE_TTL } from "@/lib/cache";
import type { PrioritizedTask } from "@/lib/ai";

const CACHE_KEY = "ai-prioritize";

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const cached = getCached<PrioritizedTask[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const tasks = await getTasks();
    const prioritized = await prioritizeTasks(tasks);

    setCache(CACHE_KEY, prioritized, CACHE_TTL.AI_PRIORITIZE);
    return NextResponse.json(prioritized);
  } catch (error) {
    console.error("AI prioritize error:", error);
    return NextResponse.json(
      { error: "AI prioritization failed" },
      { status: 500 }
    );
  }
}
