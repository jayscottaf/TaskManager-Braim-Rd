"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageMenu } from "@/components/page-menu";
import { TaskForm } from "@/components/task-form";
import { CameraCapture } from "@/components/camera-capture";
import type { PhotoClassification } from "@/lib/ai";
import type { Task } from "@/lib/types";

function AddTaskContent() {
  const searchParams = useSearchParams();

  // Build prefill from URL params (from seasonal banner, calendar, contractors) or camera
  function getUrlPrefill(): Partial<Task> | undefined {
    const prefill: Record<string, unknown> = {};
    const task = searchParams.get("task");
    if (task) prefill.task = task;
    const area = searchParams.get("area");
    if (area) prefill.area = area;
    const types = searchParams.get("types") || searchParams.get("type");
    if (types) prefill.type = types.split(",");
    const priority = searchParams.get("priority");
    if (priority) prefill.priority = priority;
    const frequency = searchParams.get("frequency");
    if (frequency) prefill.frequency = frequency;
    const dueDate = searchParams.get("dueDate");
    if (dueDate) prefill.dueDate = { start: dueDate };
    const contractor = searchParams.get("contractor");
    if (contractor) prefill.contractorVendor = contractor;
    return Object.keys(prefill).length > 0 ? (prefill as Partial<Task>) : undefined;
  }

  const urlPrefill = getUrlPrefill();
  const [cameraPrefill, setCameraPrefill] = useState<Partial<Task> | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const prefill = cameraPrefill || urlPrefill || undefined;

  function handleClassified(result: PhotoClassification | null, urls: string[]) {
    setPhotoUrls(urls);
    if (result) {
      setCameraPrefill({
        task: result.task,
        type: result.type,
        area: result.area,
        priority: result.priority,
        costEstimate: result.costEstimate,
      } as Partial<Task>);
    }
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
        photoUrls={photoUrls}
      />
    </>
  );
}

export default function AddTaskPage() {
  return (
    <div className="flex flex-col gap-6 pt-6 pb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 active:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </Link>
          <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Add Task</h1>
        </div>
        <PageMenu />
      </div>

      <Suspense fallback={<div className="px-5 py-8 text-center text-neutral-400 text-sm">Loading...</div>}>
        <AddTaskContent />
      </Suspense>
    </div>
  );
}
