import type { Task } from "@/lib/types";
import { TaskCard } from "@/components/task-card";

interface AreaProgressGroupProps {
  area: string;
  tasks: Task[];
  population?: Task[];
}

export function AreaProgressGroup({
  area,
  tasks,
  population = tasks,
}: AreaProgressGroupProps) {
  const completed = population.filter((t) => t.status === "Completed").length;
  const total = population.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const active = tasks.filter((t) => t.status !== "Completed");
  const done = tasks.filter((t) => t.status === "Completed");

  return (
    <details className="group" open={active.length > 0}>
      <summary className="flex items-center gap-3 cursor-pointer list-none p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              {area}
            </h3>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {completed}/{total} done
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${area} tasks completed`}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </summary>
      <div className="flex flex-col gap-3 mt-3">
        {active.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
        {done.length > 0 && (
          <details className="group/done">
            <summary className="text-xs text-neutral-400 cursor-pointer list-none flex items-center gap-1 px-1 hover:text-neutral-600 dark:hover:text-neutral-300">
              {done.length} completed
            </summary>
            <div className="flex flex-col gap-2 mt-2 opacity-60">
              {done.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </details>
        )}
      </div>
    </details>
  );
}
