import { NextRequest, NextResponse } from "next/server";
import { getTasks, createTask } from "@/lib/notion";
import { checkAuth } from "@/lib/auth";
import { advanceDate } from "@/lib/recurrence";
import type { Status, Priority, Area, Frequency } from "@/lib/types";

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = request.nextUrl;
    const tasks = await getTasks({
      status: (searchParams.get("status") as Status) || undefined,
      priority: (searchParams.get("priority") as Priority) || undefined,
      area: (searchParams.get("area") as Area) || undefined,
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    if (!body.task || typeof body.task !== "string") {
      return NextResponse.json(
        { error: "Task name is required" },
        { status: 400 }
      );
    }
    const task = await createTask(body);

    // If recurring with a due date, create the next occurrence immediately
    const freq = body.frequency as Frequency | undefined;
    if (freq && freq !== "One-time" && body.dueDate?.start) {
      const nextStart = advanceDate(body.dueDate.start, freq);
      const nextEnd = body.dueDate.end
        ? advanceDate(body.dueDate.end, freq)
        : undefined;
      await createTask({
        ...body,
        status: undefined, // default "Not Started"
        dueDate: { start: nextStart, ...(nextEnd ? { end: nextEnd } : {}) },
      });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
