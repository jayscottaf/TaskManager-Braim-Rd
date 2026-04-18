import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTask, ensureNotesProperty } from "@/lib/notion";
import { TaskDetailClient } from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: PageProps) {
  const { id } = await params;
  let task;

  try {
    await ensureNotesProperty();
    task = await getTask(id);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500">Task not found</p>
        <Link href="/" className="text-gray-900 font-medium underline">
          Back to tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-6 pb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5">
        <Link
          href="/"
          className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </Link>
        <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50 truncate">
          {task.task}
        </h1>
      </div>

      <TaskDetailClient task={task} />
    </div>
  );
}
