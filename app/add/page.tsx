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
    <div className="flex flex-col gap-4 pt-2 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-2">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Add Task</h1>
      </div>

      {/* Camera */}
      <div className="px-4">
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
