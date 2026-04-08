import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTask } from "@/lib/notion";
import { TaskDetailClient } from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: PageProps) {
  const { id } = await params;
  let task;

  try {
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
    <div className="flex flex-col gap-4 pt-2 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-2">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 truncate">
          {task.task}
        </h1>
      </div>

      <TaskDetailClient task={task} />
    </div>
  );
}
