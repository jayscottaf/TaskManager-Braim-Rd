import Link from "next/link";
import type { Task } from "@/lib/types";

export function DashboardAside({ tasks }: { tasks: Task[] }) {
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const recordedCost = tasks
    .filter((task) => task.status === "Completed")
    .reduce((sum, task) => sum + (task.actualCost ?? 0), 0);
  return (
    <div className="sticky top-6 flex flex-col gap-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
          Your home, over time
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          Saved ideas can stay saved. Your plan is what you choose to work on.
        </p>
        {completed > 0 && (
          <p className="mt-5 text-sm text-neutral-600 dark:text-neutral-300">
            {completed} task{completed === 1 ? "" : "s"} completed
          </p>
        )}
        {recordedCost > 0 && (
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            ${recordedCost.toLocaleString()} in recorded actual costs
          </p>
        )}
        <Link
          href="/spending"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-blue-600 dark:text-blue-400"
        >
          Review spending →
        </Link>
      </section>
    </div>
  );
}
