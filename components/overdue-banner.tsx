import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Task } from "@/lib/types";
import { isOverdueDeadline } from "@/lib/home-plan";

/** Used only where the deadline task itself is not already shown. */
export function OverdueBanner({ tasks }: { tasks: Task[] }) {
  const deadlines = tasks.filter((task) => isOverdueDeadline(task));
  if (!deadlines.length) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
      <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
        <AlertTriangle className="h-4 w-4" />
        {deadlines.length} firm deadline
        {deadlines.length === 1 ? " needs" : "s need"} attention
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {deadlines.map((task) => (
          <Link
            key={task.id}
            href={`/task/${task.id}`}
            className="inline-flex min-h-11 items-center text-sm text-neutral-700 underline underline-offset-4 dark:text-neutral-200"
          >
            {task.task}
          </Link>
        ))}
      </div>
    </div>
  );
}
