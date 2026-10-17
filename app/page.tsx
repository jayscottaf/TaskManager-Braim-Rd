export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageMenu } from "@/components/page-menu";
import { ErrorDetails } from "@/components/error-details";
import { getTasks } from "@/lib/notion";
import { TaskCard } from "@/components/task-card";
import { TaskSection } from "@/components/task-section";
import { TaskFilters } from "@/components/task-filters";
import { SeasonalBanner } from "@/components/seasonal-banner";
import { HomePlanStorageSync, StartMyDay } from "@/components/start-my-day";
import { DashboardAside } from "@/components/dashboard-aside";
import { AreaProgressGroup } from "@/components/area-progress-group";
import { isOverdueDeadline, localDateKey, taskDateKey } from "@/lib/home-plan";
import type { Task } from "@/lib/types";
import { calendarDateKey, householdCalendarNow } from "@/lib/household-date";
import { groupTaskVisibility, repeatsNeedingAttention } from "@/lib/task-visibility";

type Filters = {
  status?: string;
  priority?: string;
  area?: string;
  range?: string;
  q?: string;
  tag?: string;
  workMode?: string;
  view?: string;
  list?: string;
};
interface PageProps {
  searchParams: Promise<Filters>;
}

async function DashboardContent({
  params,
  showAll,
}: {
  params: Filters;
  showAll: boolean;
}) {
  let allTasks: Task[];
  try {
    allTasks = await getTasks();
  } catch (error) {
    const err = error as { code?: string; message?: string };
    return (
      <div className="mx-5 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20">
        <p className="font-semibold text-red-700 dark:text-red-400">
          Could not load your tasks
        </p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          Your saved work is still there. Refresh to try again.
        </p>
        <ErrorDetails message={err.message} code={err.code} />
      </div>
    );
  }
  const today = localDateKey();
  const weekDate = householdCalendarNow();
  weekDate.setDate(weekDate.getDate() + 7);
  const weekEnd = calendarDateKey(weekDate);
  const activeTasks = allTasks.filter((task) => task.status !== "Completed");
  const pendingRepeats = repeatsNeedingAttention(allTasks);
  // Deadlines remain visible independently of backlog filters and planning time.
  const deadlines = activeTasks
    .filter(
      (task) =>
        task.isDeadline && taskDateKey(task) && taskDateKey(task)! <= weekEnd,
    )
    .sort((a, b) => taskDateKey(a)!.localeCompare(taskDateKey(b)!));

  let tasks = allTasks.filter((task) =>
    params.status ? task.status === params.status : task.status !== "Completed",
  );
  if (params.priority)
    tasks = tasks.filter((task) => task.priority === params.priority);
  if (params.area) tasks = tasks.filter((task) => task.area === params.area);
  if (params.workMode)
    tasks = tasks.filter((task) => task.workMode === params.workMode);
  if (params.tag)
    tasks = tasks.filter((task) =>
      task.tags.some((tag) =>
        tag.toLowerCase().includes(params.tag!.toLowerCase()),
      ),
    );
  if (params.q?.trim()) {
    const query = params.q.trim().toLowerCase();
    tasks = tasks.filter((task) =>
      [
        task.task,
        task.area,
        task.notes,
        task.contractorVendor,
        ...task.tags,
        ...task.type,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  } else {
    const rangeDays = Number(params.range ?? "0");
    if (rangeDays > 0) {
      const cutoff = householdCalendarNow();
      cutoff.setDate(cutoff.getDate() + rangeDays);
      const cutoffKey = calendarDateKey(cutoff);
      tasks = tasks.filter(
        (task) => !taskDateKey(task) || taskDateKey(task)! <= cutoffKey,
      );
    }
  }
  tasks.sort(
    (a, b) =>
      Number(isOverdueDeadline(b, today)) -
        Number(isOverdueDeadline(a, today)) ||
      (taskDateKey(a) ?? "9999").localeCompare(taskDateKey(b) ?? "9999") ||
      a.task.localeCompare(b.task),
  );
  const card = (task: Task) => (
    <TaskCard key={`${task.id}:${task.status}:${task.priority}`} task={task} />
  );

  const deadlineIds = new Set(deadlines.map((task) => task.id));
  const { current, upcomingRepeats } = groupTaskVisibility(
    tasks.filter((task) => !deadlineIds.has(task.id)),
    today,
  );
  const filtered = Boolean(
    params.q ||
      params.status ||
      params.priority ||
      params.area ||
      params.tag ||
      params.workMode ||
      (params.range && params.range !== "0"),
  );
  const areaGroups = new Map<string, Task[]>();
  current.forEach((task) => {
    const area = task.area || "Uncategorized";
    areaGroups.set(area, [...(areaGroups.get(area) ?? []), task]);
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-5">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          {!showAll ? (
            <StartMyDay tasks={allTasks} />
          ) : (
            <HomePlanStorageSync tasks={allTasks} />
          )}
          {pendingRepeats.length > 0 && (
            <TaskSection
              title="Repeats needing attention"
              count={pendingRepeats.length}
            >
              {pendingRepeats.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {task.task}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Completed and saved. Its next repeat still needs scheduling.
                  </p>
                  <Link
                    href={`/task/${task.id}?returnTo=${encodeURIComponent(showAll ? "/?list=all" : "/")}`}
                    className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-blue-600 dark:text-blue-400"
                  >
                    Retry scheduling
                    <span className="sr-only"> for {task.task}</span>
                  </Link>
                </div>
              ))}
            </TaskSection>
          )}
          {deadlines.length > 0 && (
            <TaskSection
              title="Firm deadlines needing attention"
              count={deadlines.length}
              accent={
                deadlines.some((task) => isOverdueDeadline(task, today))
                  ? "overdue"
                  : undefined
              }
            >
              {deadlines.map(card)}
            </TaskSection>
          )}
          {!showAll ? (
            <>
              <Link
                href="/?list=all"
                className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    View all tasks
                  </p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Review your ideas and plans when you’re ready.
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-neutral-400" />
              </Link>
              <details className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                <summary className="cursor-pointer text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  Seasonal ideas
                </summary>
                <div className="mt-4 -mx-5">
                  <SeasonalBanner />
                </div>
              </details>
            </>
          ) : (
            <>
              <Suspense fallback={null}>
                <TaskFilters />
              </Suspense>
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {filtered
                      ? "No matching tasks"
                      : "A place for your home projects"}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    {filtered
                      ? "Try another search or clear your filters."
                      : "Capture something now. Decide when to tackle it later."}
                  </p>
                  <Link
                    href={filtered ? "/?list=all" : "/add"}
                    className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-blue-600 dark:text-blue-400"
                  >
                    {filtered ? "Clear filters" : "Add your first task"}
                  </Link>
                </div>
              ) : (
                <>
                  {params.view === "area" ? (
                    <div className="flex flex-col gap-4">
                      {[...areaGroups.entries()]
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([area, areaTasks]) => (
                          <AreaProgressGroup
                            key={area}
                            area={area}
                            tasks={areaTasks}
                            population={allTasks.filter(
                              (task) => (task.area || "Uncategorized") === area,
                            )}
                          />
                        ))}
                    </div>
                  ) : (
                    <TaskSection
                      title={params.status === "Completed" ? "Completed" : "Tasks"}
                      count={current.length}
                    >
                      {current.map(card)}
                    </TaskSection>
                  )}
                  {current.length === 0 && upcomingRepeats.length > 0 && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Your remaining repeating tasks are planned for later.
                      They’re saved under Upcoming repeats below.
                    </p>
                  )}
                  {upcomingRepeats.length > 0 && (
                    <details
                      open={filtered || undefined}
                      className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
                    >
                      <summary className="cursor-pointer text-sm font-medium text-neutral-600 dark:text-neutral-300">
                        Upcoming repeats{" "}
                        <span className="ml-2 text-neutral-500">
                          {upcomingRepeats.length}
                        </span>
                      </summary>
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        These repeats haven’t been started and are planned for
                        later. They’ll return to your task list on their planned
                        day.
                      </p>
                      <div className="mt-4 flex flex-col gap-3">
                        {upcomingRepeats.map(card)}
                      </div>
                    </details>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <aside className="hidden lg:block">
          <DashboardAside tasks={allTasks} />
        </aside>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-5"
      role="status"
      aria-label="Loading your tasks"
    >
      <div className="h-72 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const showAll =
    params.list === "all" ||
    Boolean(
      params.q ||
        params.status ||
        params.priority ||
        params.area ||
        params.range ||
        params.tag ||
        params.workMode ||
        params.view,
    );
  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="mx-auto flex w-full max-w-6xl items-start justify-between gap-3 px-5">
        <div>
          {showAll && (
            <Link
              href="/"
              className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Your plan
            </Link>
          )}
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Braim Rd
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            {showAll ? "All tasks" : "A little care for home."}
          </h1>
        </div>
        <PageMenu />
      </header>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent params={params} showAll={showAll} />
      </Suspense>
    </div>
  );
}
