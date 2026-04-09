"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TaskForm } from "@/components/task-form";
import { CameraCapture } from "@/components/camera-capture";
import type { PhotoClassification } from "@/lib/ai";
import type { Task } from "@/lib/types";

export default function AddTaskPage() {
  const [prefill, setPrefill] = useState<Partial<Task> | null>(null);

  function handleClassified(result: PhotoClassification) {
    setPrefill({
      task: result.task,
      type: result.type,
      area: result.area,
      priority: result.priority,
      costEstimate: result.costEstimate,
    } as Partial<Task>);
  }

  return (
    <div className="flex flex-col gap-6 pt-6 pb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5">
        <Link
          href="/"
          className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 active:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950">Add Task</h1>
      </div>

      {/* Camera */}
      <div className="px-5">
        <CameraCapture onClassified={handleClassified} />
      </div>

      {/* Form */}
      <TaskForm
        mode="create"
        key={prefill ? JSON.stringify(prefill) : "empty"}
        task={prefill as Task | undefined}
      />
    </div>
  );
}
