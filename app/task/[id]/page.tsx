import Link from "next/link";
import { getTask } from "@/lib/notion";
import { safeReturnTo } from "@/lib/client-request";
import { TaskBackButton, TaskDetailClient } from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function TaskDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const returnTo = safeReturnTo((await searchParams).returnTo);
  let task;

  try {
    task = await getTask(id);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted">Could not load this task. Refresh to try again.</p>
        <Link href="/" className="text-accent min-h-11 font-medium underline">
          Back to your plan
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-6 pb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5">
        <TaskBackButton returnTo={returnTo} />
        <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50 break-words min-w-0">
          {task.task}
        </h1>
      </div>

      <TaskDetailClient task={task} returnTo={returnTo} />
    </div>
  );
}
