"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Task } from "@/lib/types";
import { TaskForm, type TaskAIUpdate } from "@/components/task-form";
import { TaskAIAnalysis } from "@/components/task-ai-analysis";

export function TaskDetailClient({ task, returnTo }: { task: Task; returnTo?: string | null }) {
  const [aiUpdate, setAIUpdate] = useState<TaskAIUpdate>({ revision: 0 });
  return (
    <div className="flex flex-col gap-6">
      <TaskForm task={task} mode="edit" returnTo={returnTo} aiUpdate={aiUpdate}>
        <TaskAIAnalysis
          task={task}
          onAnalysis={(analysis) => setAIUpdate((previous) => ({ revision: previous.revision + 1, analysis }))}
          onApply={(changes) => setAIUpdate((previous) => ({ ...changes, revision: previous.revision + 1 }))}
        />
      </TaskForm>
    </div>
  );
}

export function TaskBackButton({ returnTo }: { returnTo?: string | null }) {
  const router = useRouter();
  return <button type="button" aria-label="Back to previous screen" onClick={() => {
    if (returnTo) router.push(returnTo);
    else if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push("/");
  }} className="flex shrink-0 items-center justify-center w-11 h-11 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" /></button>;
}
