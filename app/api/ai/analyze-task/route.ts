import { NextRequest, NextResponse } from "next/server";
import { analyzeTask } from "@/lib/ai";
import { getTask } from "@/lib/notion";
import { checkAuth } from "@/lib/auth";
import { getCached, setCache, clearCache, CACHE_TTL } from "@/lib/cache";
import type { Task } from "@/lib/types";

export const maxDuration = 30;

function fieldHash(task: Task): string {
  // Simple hash of the fields that affect analysis — edits invalidate cache
  const input = `${task.task}|${task.area ?? ""}|${task.type.join(",")}|${task.priority ?? ""}|${task.costEstimate ?? ""}|${(task.notes ?? "").slice(0, 500)}`;
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { id, force } = await request.json();
    if (!id) return NextResponse.json({ error: "Task id required" }, { status: 400 });

    const task = await getTask(id);
    const cacheKey = `ai-analyze:${id}:${fieldHash(task)}`;

    if (force) clearCache(cacheKey);
    const cached = getCached<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const analysis = await analyzeTask(task);
    setCache(cacheKey, analysis, CACHE_TTL.TASK_ANALYSIS);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("AI analyze-task error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
