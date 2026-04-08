import { NextRequest, NextResponse } from "next/server";
import { getTasks } from "@/lib/notion";
import { suggestTasks } from "@/lib/ai";
import { checkAuth } from "@/lib/auth";
import { getCached, setCache, CACHE_TTL } from "@/lib/cache";
import type { AISuggestion } from "@/lib/ai";

const CACHE_KEY = "ai-suggest";

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const cached = getCached<AISuggestion[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const tasks = await getTasks();
    const suggestions = await suggestTasks(tasks);

    setCache(CACHE_KEY, suggestions, CACHE_TTL.AI_SUGGEST);
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("AI suggest error:", error);
    return NextResponse.json(
      { error: "AI suggestions failed" },
      { status: 500 }
    );
  }
}
