export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getTasks } from "@/lib/notion";
import { TaskCard } from "@/components/task-card";
import { TaskFilters } from "@/components/task-filters";
import { SeasonalBanner } from "@/components/seasonal-banner";
import { OverdueBanner } from "@/components/overdue-banner";
import { AIPanel } from "@/components/ai-panel";
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
  const tasks = await getTasks({ status, priority, area });

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg font-medium">No tasks found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <>
      <OverdueBanner tasks={tasks} />
      <div className="flex flex-col gap-3 px-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </>
  );
}

function TaskListSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
        >
          <div className="flex gap-2 mb-2">
            <div className="h-5 w-12 bg-gray-200 rounded-full" />
            <div className="h-5 w-20 bg-gray-200 rounded-full" />
          </div>
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="flex gap-3 mt-2">
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-4 pt-2 pb-4">
      {/* Header */}
      <div className="px-4 pt-2">
        <h1 className="text-2xl font-bold text-gray-900">Braim Rd</h1>
        <p className="text-sm text-gray-500 mt-0.5">Home Maintenance</p>
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
