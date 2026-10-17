"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  addWeeks,
  addDays,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Repeat,
  CalendarDays,
  CalendarRange,
  List,
} from "lucide-react";
import type { Task } from "@/lib/types";
import { generateOccurrences } from "@/lib/recurrence";
import { isOverdueDeadline } from "@/lib/home-plan";
import { calendarDateKey, householdCalendarNow } from "@/lib/household-date";
import { calendarDay, tasksOnCalendarDay } from "@/lib/calendar-state";
import Link from "next/link";

type ViewMode = "month" | "week" | "agenda";
function isVirtual(task: Task) {
  return task.id.includes("_recur_");
}
function realId(task: Task) {
  return task.id.split("_recur_")[0];
}

function TaskPill({
  task,
  returnTo,
  compact = false,
}: {
  task: Task;
  returnTo: string;
  compact?: boolean;
}) {
  const virtual = isVirtual(task);
  const overdue = !virtual && isOverdueDeadline(task);
  return (
    <Link
      href={`/task/${realId(task)}?returnTo=${encodeURIComponent(returnTo)}`}
      aria-label={`${task.task}${virtual ? ", projected recurrence; opens original task" : ""}`}
      className={`flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm leading-relaxed ${overdue ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"} ${task.status === "Completed" ? "line-through" : ""}`}
    >
      {virtual && <Repeat className="h-3.5 w-3.5 shrink-0" />}
      <span
        className={`min-w-0 flex-1 ${compact ? "truncate text-xs" : "break-words"}`}
      >
        {task.task}
        {virtual && (
          <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">
            · Projected
          </span>
        )}
      </span>
      {overdue && !compact && (
        <span className="text-xs font-medium">Deadline passed</span>
      )}
    </Link>
  );
}

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const params = useSearchParams();
  const today = householdCalendarNow();
  const viewMode: ViewMode =
    params.get("view") === "week"
      ? "week"
      : params.get("view") === "agenda"
        ? "agenda"
        : "month";
  const anchor = calendarDay(params.get("date")) ?? today;
  const selectedDate = calendarDay(params.get("selected"));
  const calStart =
    viewMode === "week"
      ? startOfWeek(anchor)
      : viewMode === "agenda"
        ? anchor
        : startOfWeek(startOfMonth(anchor));
  const calEnd =
    viewMode === "week"
      ? endOfWeek(anchor)
      : viewMode === "agenda"
        ? addDays(anchor, 13)
        : endOfWeek(endOfMonth(anchor));
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const allTasks = useMemo(() => {
    const date = calendarDay(params.get("date")) ?? householdCalendarNow();
    const start =
      viewMode === "week"
        ? startOfWeek(date)
        : viewMode === "agenda"
          ? date
          : startOfWeek(startOfMonth(date));
    const end =
      viewMode === "week"
        ? endOfWeek(date)
        : viewMode === "agenda"
          ? addDays(date, 13)
          : endOfWeek(endOfMonth(date));
    return [
      ...tasks,
      ...tasks.flatMap((task) =>
        generateOccurrences(task, calendarDateKey(start), calendarDateKey(end)),
      ),
    ];
  }, [tasks, params, viewMode]);
  const tasksByDay = new Map(
    days.map((day) => [
      calendarDateKey(day),
      tasksOnCalendarDay(allTasks, calendarDateKey(day)),
    ]),
  );
  const selectedTasks = selectedDate
    ? tasksOnCalendarDay(allTasks, calendarDateKey(selectedDate))
    : [];
  const returnParams = new URLSearchParams(params.toString());
  returnParams.set("view", viewMode);
  returnParams.set("date", calendarDateKey(anchor));
  const returnTo = `/calendar?${returnParams.toString()}`;

  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    next.set("date", calendarDateKey(anchor));
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Native history integrates with Next search params without fetching tasks again.
    window.history.replaceState(null, "", `/calendar?${next.toString()}`);
  }
  function navigate(direction: -1 | 1) {
    const next =
      viewMode === "month"
        ? addMonths(anchor, direction)
        : viewMode === "week"
          ? addWeeks(anchor, direction)
          : addDays(anchor, direction * 14);
    update({ date: calendarDateKey(next), selected: null });
  }
  function addHref(day: Date) {
    const back = new URLSearchParams(returnParams.toString());
    back.set("selected", calendarDateKey(day));
    return `/add?dueDate=${calendarDateKey(day)}&returnTo=${encodeURIComponent(`/calendar?${back.toString()}`)}`;
  }
  const navTitle =
    viewMode === "month"
      ? format(anchor, "MMMM yyyy")
      : `${format(calStart, "MMM d")} – ${format(calEnd, "MMM d, yyyy")}`;
  const views = [
    { mode: "month" as const, icon: CalendarDays, label: "Month" },
    { mode: "week" as const, icon: CalendarRange, label: "Week" },
    { mode: "agenda" as const, icon: List, label: "Agenda" },
  ];

  return (
    <div className="flex flex-col gap-4 px-3 sm:px-5">
      <div
        role="group"
        aria-label="Calendar view"
        className="flex flex-wrap justify-center gap-1"
      >
        {views.map(({ mode, icon: Icon, label }) => (
          <button
            type="button"
            key={mode}
            aria-pressed={viewMode === mode}
            onClick={() => update({ view: mode, selected: null })}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium ${viewMode === mode ? "bg-blue-600 text-white" : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={`Previous ${viewMode === "agenda" ? "14 days" : viewMode}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h2
            aria-live="polite"
            className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
          >
            {navTitle}
          </h2>
          <button
            type="button"
            onClick={() =>
              update({
                date: calendarDateKey(today),
                selected: calendarDateKey(today),
              })
            }
            className="min-h-11 px-3 text-sm font-medium text-blue-600 dark:text-blue-400"
          >
            Today
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label={`Next ${viewMode === "agenda" ? "14 days" : viewMode}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      {viewMode === "month" ? (
        <>
          <div className="grid grid-cols-7 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span
                key={day}
                className="py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"
              >
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-700">
            {days.map((day) => {
              const dayKey = calendarDateKey(day);
              const dayTasks = tasksByDay.get(dayKey) ?? [];
              const selected = Boolean(
                selectedDate && isSameDay(day, selectedDate),
              );
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={dayKey}
                  className={`min-w-0 bg-white p-0.5 dark:bg-neutral-900 ${selected ? "ring-2 ring-inset ring-blue-500" : ""}`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${format(day, "EEEE, MMMM d, yyyy")}, ${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"}`}
                    onClick={() =>
                      update({ selected: selected ? null : dayKey })
                    }
                    className="flex min-h-20 w-full flex-col items-center justify-between rounded-lg px-1 py-2 sm:min-h-11 sm:flex-row"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-blue-600 text-white" : isSameMonth(day, anchor) ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400"}`}
                    >
                      {format(day, "d")}
                    </span>
                    <span className="flex flex-wrap justify-center gap-1 sm:hidden">
                      {dayTasks.slice(0, 4).map((task) => (
                        <span
                          key={task.id}
                          className={`h-1.5 w-1.5 rounded-full ${!isVirtual(task) && isOverdueDeadline(task) ? "bg-red-500" : "bg-neutral-500"}`}
                        />
                      ))}
                    </span>
                  </button>
                  <div className="hidden flex-col gap-1 pb-1 sm:flex">
                    {dayTasks.slice(0, 2).map((task) => (
                      <TaskPill
                        key={task.id}
                        task={task}
                        returnTo={returnTo}
                        compact
                      />
                    ))}
                    {dayTasks.length > 2 && (
                      <button
                        type="button"
                        onClick={() => update({ selected: dayKey })}
                        aria-label={`Show all ${dayTasks.length} tasks for ${format(day, "MMMM d")}`}
                        className="min-h-11 px-2 text-left text-xs text-neutral-500 dark:text-neutral-400"
                      >
                        +{dayTasks.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedDate && (
            <section
              aria-label={`Tasks for ${format(selectedDate, "MMMM d")}`}
              className="mt-2 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {format(selectedDate, "EEEE, MMMM d")}
              </h3>
              <div className="mt-3 flex flex-col gap-2">
                {selectedTasks.map((task) => (
                  <TaskPill key={task.id} task={task} returnTo={returnTo} />
                ))}
                {selectedTasks.length === 0 && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Nothing planned for this day.
                  </p>
                )}
              </div>
              <Link
                href={addHref(selectedDate)}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                <Plus className="h-4 w-4" />
                Plan a task
              </Link>
            </section>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((day) => {
            const dayKey = calendarDateKey(day);
            const dayTasks = tasksByDay.get(dayKey) ?? [];
            return (
              <section
                key={dayKey}
                className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className={`text-sm font-semibold ${isSameDay(day, today) ? "text-blue-600 dark:text-blue-400" : "text-neutral-700 dark:text-neutral-200"}`}
                  >
                    {format(day, "EEEE, MMM d")}
                    {isSameDay(day, today) ? " · Today" : ""}
                  </h3>
                  <Link
                    href={addHref(day)}
                    aria-label={`Plan a task for ${format(day, "MMMM d")}`}
                    className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-blue-600 dark:text-blue-400"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Link>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {dayTasks.map((task) => (
                    <TaskPill key={task.id} task={task} returnTo={returnTo} />
                  ))}
                  {dayTasks.length === 0 && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Nothing planned.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Dates are plans unless you mark a firm deadline. Projected repeats open
        the original task.
      </p>
    </div>
  );
}
