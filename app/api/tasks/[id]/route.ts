import { NextRequest, NextResponse } from "next/server";
import { getTask, deleteTask, withTaskMutation } from "@/lib/notion";
import { checkAuth } from "@/lib/auth";
import { RecurrencePendingError, updateTaskWithRecurrence } from "../mutations";
import { validateTaskInput } from "../validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    return NextResponse.json(await getTask(id));
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const authError = checkAuth(request);
  if (authError) return authError;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid task JSON" }, { status: 400 }); }
  const validated = validateTaskInput(body, "update");
  if (!validated.input) return NextResponse.json({ error: validated.error }, { status: 400 });
  try {
    const { id } = await params;
    return NextResponse.json(await updateTaskWithRecurrence(id, validated.input));
  } catch (error) {
    if (error instanceof RecurrencePendingError) return NextResponse.json({ error: error.message, saved: true, recurrencePending: true, task: error.task }, { status: 502 });
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const authError = checkAuth(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    await withTaskMutation(id, () => deleteTask(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
