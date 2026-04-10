"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TaskForm } from "@/components/task-form";
import { CameraCapture } from "@/components/camera-capture";
import type { PhotoClassification } from "@/lib/ai";
import type { Task } from "@/lib/types";

function AddTaskContent() {
  const searchParams = useSearchParams();

  // Build prefill from URL params (from seasonal banner) or camera
  function getUrlPrefill(): Partial<Task> | undefined {
    const task = searchParams.get("task");
    if (!task) return undefined;
    const prefill: Partial<Task> = { task } as Partial<Task>;
    const area = searchParams.get("area");
    if (area) (prefill as Record<string, unknown>).area = area;
    const types = searchParams.get("types");
    if (types) (prefill as Record<string, unknown>).type = types.split(",");
    const priority = searchParams.get("priority");
    if (priority) (prefill as Record<string, unknown>).priority = priority;
    const frequency = searchParams.get("frequency");
    if (frequency) (prefill as Record<string, unknown>).frequency = frequency;
    const dueDate = searchParams.get("dueDate");
    if (dueDate) (prefill as Record<string, unknown>).dueDate = { start: dueDate };
    return prefill;
  }

  const urlPrefill = getUrlPrefill();
  const [cameraPrefill, setCameraPrefill] = useState<Partial<Task> | null>(null);

  const prefill = cameraPrefill || urlPrefill || undefined;

  function handleClassified(result: PhotoClassification) {
    setCameraPrefill({
      task: result.task,
      type: result.type,
      area: result.area,
      priority: result.priority,
      costEstimate: result.costEstimate,
    } as Partial<Task>);
  }

  return (
    <>
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
    </>
  );
}

export default function AddTaskPage() {
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
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Add Task</h1>
      </div>

      <Suspense fallback={<div className="px-5 py-8 text-center text-neutral-400 text-sm">Loading...</div>}>
        <AddTaskContent />
      </Suspense>
    </div>
  );
}
