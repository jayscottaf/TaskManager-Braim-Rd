export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getTasks } from "@/lib/notion";
import { TaskCard } from "@/components/task-card";
import { TaskFilters } from "@/components/task-filters";
import { SeasonalBanner } from "@/components/seasonal-banner";
import { OverdueBanner } from "@/components/overdue-banner";
import { AIPanel } from "@/components/ai-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Status, Priority, Area } from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ status?: string; priority?: string; area?: string }>;
}

async function TaskList({
  status,
  priority,
  area,
}: {
  status?: Status;
  priority?: Priority;
  area?: Area;
}) {
  let tasks;
  try {
    const allTasks = await getTasks({ status, priority, area });
    // Hide completed tasks from dashboard unless explicitly filtered to Completed
    tasks = status === "Completed" ? allTasks : allTasks.filter((t) => t.status !== "Completed");
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    return (
      <div className="mx-5 p-5 bg-red-50 dark:bg-red-950/30 rounded-2xl">
        <p className="font-semibold text-red-700">Notion API Error</p>
        <p className="text-sm text-red-600 mt-1">{e.message}</p>
        {e.code && <p className="text-xs text-neutral-500 mt-1">Code: {e.code}</p>}
        <p className="text-xs text-neutral-400 mt-2">
          Check: NOTION_API_KEY and NOTION_DATABASE_ID in Vercel env vars.
        </p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="text-4xl mb-3">🏡</div>
        <p className="text-lg font-semibold text-neutral-950">All clear</p>
        <p className="text-sm text-neutral-400 mt-1">No tasks match your filters</p>
      </div>
    );
  }

  return (
    <>
      <OverdueBanner tasks={tasks} />
      <div className="flex flex-col gap-3 px-5 animate-fade-in">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </>
  );
}

function TaskListSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5 animate-pulse"
        >
          <div className="flex gap-2 mb-3">
            <div className="h-5 w-14 bg-neutral-100 rounded-md" />
            <div className="h-5 w-20 bg-neutral-100 rounded-md" />
          </div>
          <div className="h-5 w-48 bg-neutral-100 rounded-md" />
          <div className="flex gap-3 mt-3">
            <div className="h-4 w-20 bg-neutral-50 rounded-md" />
            <div className="h-4 w-16 bg-neutral-50 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between px-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Braim Rd</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Home Maintenance Tracker</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Seasonal Banner */}
      <SeasonalBanner />

      {/* Filters */}
      <Suspense fallback={null}>
        <TaskFilters />
      </Suspense>

      {/* Task List */}
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskList
          status={params.status as Status | undefined}
          priority={params.priority as Priority | undefined}
          area={params.area as Area | undefined}
        />
      </Suspense>

      {/* AI Panel */}
      <AIPanel />
    </div>
  );
}
