import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { analyzeTask } from "@/lib/ai";
import { getTask } from "@/lib/notion";
import { checkAuth } from "@/lib/auth";
import { getOrLoadCached, clearCache, CACHE_TTL } from "@/lib/cache";
import { isTaskAnalysis, taskAnalysisInput } from "@/lib/task-analysis";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const { id, force } = await request.json();
    if (typeof id !== "string" || !/^[0-9a-f-]{32,36}$/i.test(id)) return NextResponse.json({ error: "A valid task id is required" }, { status: 400 });
    const task = taskAnalysisInput(await getTask(id));
    const fields = [task.task, task.area, task.type, task.priority, task.costEstimate, task.notes];
    const hash = createHash("sha256").update(JSON.stringify(fields)).digest("hex").slice(0, 24);
    const key = `ai-analyze:${id}:${hash}`;
    if (force === true) clearCache(key);
    const analysis = await getOrLoadCached(key, CACHE_TTL.TASK_ANALYSIS, async () => {
      const result = await analyzeTask(task);
      if (!isTaskAnalysis(result)) throw new Error("Incomplete analysis");
      return result;
    });
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("AI task guidance failed:", error);
    return NextResponse.json({ error: "Couldn't prepare guidance. Your task is unchanged; try again in a moment." }, { status: 502 });
  }
}
