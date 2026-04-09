import { NextRequest, NextResponse } from "next/server";
import { getTask, updateTask, deleteTask, createTask } from "@/lib/notion";
import { checkAuth } from "@/lib/auth";
import type { Frequency } from "@/lib/types";

function advanceDate(dateStr: string, frequency: Frequency): string {
  const d = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "Monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "Quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "Semi-annually":
      d.setMonth(d.getMonth() + 6);
      break;
    case "Annually":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split("T")[0];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const task = await getTask(id);
    return NextResponse.json(task);
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();

    // If marking as completed, fetch current task to check for recurrence
    let nextTask = null;
    if (body.status === "Completed") {
      const current = await getTask(id);
      const freq = current.frequency;
      if (
        freq &&
        freq !== "One-time" &&
        current.dueDate?.start
      ) {
        const nextStart = advanceDate(current.dueDate.start, freq);
        const nextEnd = current.dueDate.end
          ? advanceDate(current.dueDate.end, freq)
          : undefined;
        nextTask = await createTask({
          task: current.task,
          priority: current.priority ?? undefined,
          area: current.area ?? undefined,
          subLocation: current.subLocation ?? undefined,
          type: current.type.length > 0 ? current.type : undefined,
          frequency: freq,
          dueDate: { start: nextStart, ...(nextEnd ? { end: nextEnd } : {}) },
          contractorVendor: current.contractorVendor ?? undefined,
          costEstimate: current.costEstimate ?? undefined,
        });
      }
    }

    const task = await updateTask(id, body);
    return NextResponse.json({
      ...task,
      ...(nextTask ? { nextOccurrence: nextTask } : {}),
    });
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
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
    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
