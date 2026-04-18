export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { DollarSign, Wrench, CheckCircle, Printer } from "lucide-react";
import { ErrorDetails } from "@/components/error-details";
import { getTasks } from "@/lib/notion";
import { TaskCard } from "@/components/task-card";
import { TaskFilters } from "@/components/task-filters";
import { SeasonalBanner } from "@/components/seasonal-banner";
import { OverdueBanner } from "@/components/overdue-banner";
import { AIPanel } from "@/components/ai-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Status, Priority, Area } from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ status?: string; priority?: string; area?: string; range?: string }>;
}

async function TaskList({
  status,
  priority,
  area,
  range,
}: {
  status?: Status;
  priority?: Priority;
  area?: Area;
  range?: string;
}) {
  let tasks;
  try {
    tasks = await getTasks({
      status,
      priority,
      area,
      excludeCompleted: status !== "Completed",
    });

    // Apply time range filter: show overdue tasks always + tasks due within range
    const rangeDays = parseInt(range || "30", 10);
    if (rangeDays > 0) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + rangeDays);
      tasks = tasks.filter((t) => {
        if (!t.dueDate) return true; // No due date = always show
        const due = new Date(t.dueDate.start);
        return due <= cutoff; // Includes overdue (due < now) and due within range
      });
    }

    // Sort: In Progress → Overdue → Priority → Due Date → No date last
    const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    tasks.sort((a, b) => {
      // In Progress first
      const aInProg = a.status === "In Progress" ? 1 : 0;
      const bInProg = b.status === "In Progress" ? 1 : 0;
      if (aInProg !== bInProg) return bInProg - aInProg;

      // Overdue next
      const aDate = a.dueDate ? new Date(a.dueDate.start) : null;
      const bDate = b.dueDate ? new Date(b.dueDate.start) : null;
      const aOverdue = aDate && aDate < now ? 1 : 0;
      const bOverdue = bDate && bDate < now ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;

      // Then by priority
      const aPri = PRIORITY_ORDER[a.priority || ""] ?? 3;
      const bPri = PRIORITY_ORDER[b.priority || ""] ?? 3;
      if (aPri !== bPri) return aPri - bPri;

      // Then by due date (soonest first, no-date last)
      if (aDate && bDate) return aDate.getTime() - bDate.getTime();
      if (aDate) return -1;
      if (bDate) return 1;
      return 0;
    });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    return (
      <div className="mx-5 p-5 bg-red-50 dark:bg-red-950/30 rounded-2xl">
        <p className="font-semibold text-red-700 dark:text-red-400">Having trouble connecting</p>
        <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">Try refreshing in a moment.</p>
        <ErrorDetails message={e.message} code={e.code} />
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
        <div className="flex items-center gap-1">
          <Link
            href="/checklist"
            aria-label="Printable checklist"
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          >
            <Printer className="w-5 h-5" />
          </Link>
          <Link
            href="/done"
            aria-label="Completion history"
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          >
            <CheckCircle className="w-5 h-5" />
          </Link>
          <Link
            href="/spending"
            aria-label="Spending dashboard"
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          >
            <DollarSign className="w-5 h-5" />
          </Link>
          <Link
            href="/contractors"
            aria-label="Contractors directory"
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          >
            <Wrench className="w-5 h-5" />
          </Link>
          <ThemeToggle />
        </div>
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
          range={params.range}
        />
      </Suspense>

      {/* AI Panel */}
      <AIPanel />
    </div>
  );
}
