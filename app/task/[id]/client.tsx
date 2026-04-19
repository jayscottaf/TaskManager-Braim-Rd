"use client";

import type { Task } from "@/lib/types";
import { TaskForm } from "@/components/task-form";
import { TaskAIAnalysis } from "@/components/task-ai-analysis";

export function TaskDetailClient({ task }: { task: Task }) {
  return (
    <div className="flex flex-col gap-6">
      <TaskAIAnalysis task={task} />
      <TaskForm task={task} mode="edit" />
    </div>
  );
}
