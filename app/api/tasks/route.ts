import { NextRequest, NextResponse } from "next/server";
import { getTasks, createTask } from "@/lib/notion";
import { checkAuth } from "@/lib/auth";
import { AREAS, PRIORITIES, STATUSES, type Status, type Priority, type Area } from "@/lib/types";
import { validateTaskInput } from "./validation";

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  const { searchParams } = request.nextUrl;
  for (const [name, allowed] of [["status", STATUSES], ["priority", PRIORITIES], ["area", AREAS]] as const) {
    const value = searchParams.get(name);
    if (value && !(allowed as readonly string[]).includes(value)) return NextResponse.json({ error: `Invalid ${name}` }, { status: 400 });
  }
  try {
    const tasks = await getTasks({
      status: (searchParams.get("status") as Status) || undefined,
      priority: (searchParams.get("priority") as Priority) || undefined,
      area: (searchParams.get("area") as Area) || undefined,
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid task JSON" }, { status: 400 }); }
  const validated = validateTaskInput(body, "create");
  if (!validated.input) return NextResponse.json({ error: validated.error }, { status: 400 });
  try {
    const task = await createTask(validated.input);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
