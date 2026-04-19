export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PageMenu } from "@/components/page-menu";
import { ErrorDetails } from "@/components/error-details";
import { getTasks, ensureNotesProperty } from "@/lib/notion";
import { TaskCard } from "@/components/task-card";
import { TaskSection } from "@/components/task-section";
import { TaskFilters } from "@/components/task-filters";
import { SeasonalBanner } from "@/components/seasonal-banner";
import { OverdueBanner } from "@/components/overdue-banner";
import { AIPanel } from "@/components/ai-panel";
import { DashboardAside } from "@/components/dashboard-aside";
import type { Task, Status, Priority, Area } from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ status?: string; priority?: string; area?: string; range?: string; q?: string; tag?: string }>;
}

async function DashboardContent({
  status,
  priority,
  area,
  range,
  search,
  tag,
}: {
  status?: Status;
  priority?: Priority;
  area?: Area;
  range?: string;
  search?: string;
  tag?: string;
}) {
  let tasks;
  try {
    await ensureNotesProperty();
    tasks = await getTasks({
      status,
      priority,
      area,
      excludeCompleted: status !== "Completed",
    });

    const rangeDays = parseInt(range || "30", 10);
    if (rangeDays > 0) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + rangeDays);
      tasks = tasks.filter((t) => {
        if (!t.dueDate) return true;
        const due = new Date(t.dueDate.start);
        return due <= cutoff;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter((t) =>
        t.task.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.area?.toLowerCase().includes(q) ||
        t.contractorVendor?.toLowerCase().includes(q)
      );
    }

    if (tag) {
      const tagLower = tag.toLowerCase();
      tasks = tasks.filter((t) => t.tags.some((tt) => tt.toLowerCase().includes(tagLower)));
    }

    const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    tasks.sort((a, b) => {
      const aInProg = a.status === "In Progress" ? 1 : 0;
      const bInProg = b.status === "In Progress" ? 1 : 0;
      if (aInProg !== bInProg) return bInProg - aInProg;

      const aDate = a.dueDate ? new Date(a.dueDate.start) : null;
      const bDate = b.dueDate ? new Date(b.dueDate.start) : null;
      const aOverdue = aDate && aDate < now ? 1 : 0;
      const bOverdue = bDate && bDate < now ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;

      const aPri = PRIORITY_ORDER[a.priority || ""] ?? 3;
      const bPri = PRIORITY_ORDER[b.priority || ""] ?? 3;
      if (aPri !== bPri) return aPri - bPri;

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
        <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">All clear</p>
        <p className="text-sm text-neutral-400 mt-1">No tasks match your filters</p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const overdue: Task[] = [];
  const todayTasks: Task[] = [];
  const thisWeek: Task[] = [];
  const later: Task[] = [];

  for (const t of tasks) {
    if (!t.dueDate) { later.push(t); continue; }
    const due = new Date(t.dueDate.start);
    due.setHours(0, 0, 0, 0);
    if (due < today && t.status !== "Completed") overdue.push(t);
    else if (due.getTime() === today.getTime()) todayTasks.push(t);
    else if (due <= weekEnd) thisWeek.push(t);
    else later.push(t);
  }

  return (
    <div className="lg:max-w-6xl lg:mx-auto w-full">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="flex flex-col gap-6">
          <OverdueBanner tasks={tasks} />
          <div className="flex flex-col gap-6 px-5 lg:px-0 animate-fade-in">
            <TaskSection title="Overdue" count={overdue.length} accent="overdue">
              {overdue.map((t) => <TaskCard key={t.id} task={t} />)}
            </TaskSection>
            <TaskSection title="Today" count={todayTasks.length}>
              {todayTasks.map((t) => <TaskCard key={t.id} task={t} />)}
            </TaskSection>
            <TaskSection title="This Week" count={thisWeek.length}>
              {thisWeek.map((t) => <TaskCard key={t.id} task={t} />)}
            </TaskSection>
            <TaskSection title="Later" count={later.length}>
              {later.map((t) => <TaskCard key={t.id} task={t} />)}
            </TaskSection>
          </div>
          <AIPanel />
        </div>
        <aside className="hidden lg:block mt-6">
          <DashboardAside tasks={tasks} />
        </aside>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
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
    <div className="flex flex-col gap-6 pt-6 pb-6 lg:max-w-6xl lg:mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between px-5 relative">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-[-0.01em] text-neutral-950 dark:text-neutral-50">Braim Rd</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Home Maintenance Tracker</p>
        </div>
        <PageMenu />
      </div>

      {/* Seasonal Banner */}
      <SeasonalBanner />

      {/* Filters */}
      <Suspense fallback={null}>
        <TaskFilters />
      </Suspense>

      {/* Content: task list + desktop aside */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          status={params.status as Status | undefined}
          priority={params.priority as Priority | undefined}
          area={params.area as Area | undefined}
          range={params.range}
          search={params.q}
          tag={params.tag}
        />
      </Suspense>
    </div>
  );
}
