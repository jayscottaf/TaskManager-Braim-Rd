"use client";

import type { Task } from "@/lib/types";
import { TaskForm } from "@/components/task-form";

export function TaskDetailClient({ task }: { task: Task }) {
  return <TaskForm task={task} mode="edit" />;
}
