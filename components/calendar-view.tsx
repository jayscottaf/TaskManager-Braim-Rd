"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  addMonths,
  subMonths,
  isPast,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import type { Task, Priority } from "@/lib/types";
import { generateOccurrences } from "@/lib/recurrence";
import Link from "next/link";

const PRIORITY_COLORS: Record<Priority, { bg: string; border: string; text: string }> = {
  High: { bg: "bg-red-50 dark:bg-red-950/40", border: "border-l-red-500", text: "text-red-900 dark:text-red-300" },
  Medium: { bg: "bg-yellow-50 dark:bg-yellow-950/40", border: "border-l-yellow-500", text: "text-yellow-900 dark:text-yellow-300" },
  Low: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-l-green-500", text: "text-green-900 dark:text-green-300" },
};

const DEFAULT_COLORS = { bg: "bg-gray-50 dark:bg-neutral-800", border: "border-l-gray-400", text: "text-gray-700 dark:text-neutral-300" };

const STATUS_STYLES: Record<string, string> = {
  Completed: "line-through opacity-50",
  "On Hold": "opacity-60 italic",
};

function isVirtual(task: Task): boolean {
  return task.id.includes("_recur_");
}

function realId(task: Task): string {
  return task.id.split("_recur_")[0];
}

function TaskPill({ task }: { task: Task }) {
  const colors = task.priority ? PRIORITY_COLORS[task.priority] : DEFAULT_COLORS;
  const statusStyle = STATUS_STYLES[task.status] || "";
  const virtual = isVirtual(task);

  return (
    <Link
      href={`/task/${realId(task)}`}
      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] leading-tight border-l-2 ${colors.bg} ${colors.border} ${colors.text} ${statusStyle} ${virtual ? "border-dashed" : ""} hover:brightness-95 transition-all`}
    >
      {virtual && <Repeat className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />}
      <span className="truncate">{task.task}</span>
    </Link>
  );
}

function MobileTaskDot({ task }: { task: Task }) {
  const dotColor = task.priority
    ? { High: "bg-red-500", Medium: "bg-yellow-500", Low: "bg-green-500" }[task.priority]
    : "bg-gray-400";
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${dotColor} ${task.status === "Completed" ? "opacity-40" : ""}`}
    />
  );
}

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Expand recurring tasks into virtual instances for the visible range
  const allTasks = useMemo(() => {
    const rangeStart = format(calStart, "yyyy-MM-dd");
    const rangeEnd = format(calEnd, "yyyy-MM-dd");
    const virtualTasks = tasks.flatMap((t) =>
      generateOccurrences(t, rangeStart, rangeEnd)
    );
    return [...tasks, ...virtualTasks];
  }, [tasks, calStart, calEnd]);

  function getTasksForDay(day: Date): Task[] {
    return allTasks.filter((t) => {
      if (!t.dueDate || !t.dueDate.start) return false;
      const start = new Date(t.dueDate.start + "T00:00:00");
      if (t.dueDate.end) {
        const end = new Date(t.dueDate.end + "T00:00:00");
        return isWithinInterval(day, { start, end });
      }
      return isSameDay(day, start);
    });
  }

  const selectedTasks = useMemo(
    () => (selectedDate ? getTasksForDay(selectedDate) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, allTasks]
  );

  const today = new Date();

  return (
    <div className="flex flex-col gap-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-full active:bg-gray-100 dark:active:bg-neutral-800"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-900 dark:text-neutral-50">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          {!isSameMonth(currentMonth, today) && (
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-xs text-blue-600 dark:text-blue-400 font-medium px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-full active:bg-gray-100 dark:active:bg-neutral-800"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center px-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — desktop shows task pills, mobile shows dots */}
      <div className="grid grid-cols-7 px-2 gap-px bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        {days.map((day) => {
          const dayTasks = getTasksForDay(day);
          const isInMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasOverdue = dayTasks.some(
            (t) =>
              t.status !== "Completed" &&
              t.dueDate &&
              t.dueDate.start &&
              isPast(new Date(t.dueDate.start + "T00:00:00")) &&
              t.dueDate.start < format(today, "yyyy-MM-dd")
          );

          return (
            <button
              key={day.toISOString()}
              onClick={() =>
                setSelectedDate(
                  selectedDate && isSameDay(day, selectedDate) ? null : day
                )
              }
              className={`flex flex-col min-h-[80px] sm:min-h-[100px] p-1 bg-white dark:bg-neutral-900 transition-colors text-left ${
                isSelected
                  ? "ring-2 ring-inset ring-blue-500 bg-blue-50/30 dark:bg-blue-950/30"
                  : ""
              } ${!isInMonth ? "bg-neutral-50/50 dark:bg-neutral-950/50" : ""}`}
            >
              {/* Day number */}
              <span
                className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${
                  isToday
                    ? "bg-blue-600 text-white"
                    : isInMonth
                      ? "text-gray-700 dark:text-neutral-200"
                      : "text-gray-300 dark:text-neutral-600"
                }`}
              >
                {format(day, "d")}
              </span>

              {/* Desktop: task pills */}
              <div className="hidden sm:flex flex-col gap-0.5 w-full overflow-hidden flex-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <TaskPill key={t.id} task={t} />
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-gray-400 dark:text-neutral-500 px-1">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>

              {/* Mobile: dots */}
              <div className="flex sm:hidden gap-0.5 flex-wrap justify-center mt-auto">
                {dayTasks.slice(0, 4).map((t, i) => (
                  <MobileTaskDot key={i} task={t} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDate && (
        <div className="px-4 mt-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">
            {format(selectedDate, "EEEE, MMMM d")}
            {selectedTasks.length > 0 && (
              <span className="text-gray-400 dark:text-neutral-500 font-normal ml-2">
                {selectedTasks.length} task{selectedTasks.length > 1 ? "s" : ""}
              </span>
            )}
          </h3>
          {selectedTasks.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400 dark:text-neutral-500">No tasks on this day</p>
              <Link
                href={`/add?dueDate=${format(selectedDate, "yyyy-MM-dd")}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add task
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedTasks.map((t) => {
                const colors = t.priority ? PRIORITY_COLORS[t.priority] : DEFAULT_COLORS;
                const isOverdue =
                  t.status !== "Completed" &&
                  t.dueDate &&
                  t.dueDate.start < format(today, "yyyy-MM-dd");

                const virtual = isVirtual(t);

                return (
                  <Link
                    key={t.id}
                    href={`/task/${realId(t)}`}
                    className={`flex items-start gap-3 rounded-lg border p-3 bg-white dark:bg-neutral-900 active:bg-gray-50 dark:active:bg-neutral-800 border-l-4 ${colors.border} ${virtual ? "border-dashed border-gray-300 dark:border-neutral-700" : "border-gray-200 dark:border-neutral-800"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium text-gray-900 dark:text-neutral-50 ${t.status === "Completed" ? "line-through opacity-60" : ""}`}>
                        {virtual && <Repeat className="w-3 h-3 inline mr-1 opacity-50" />}
                        {t.task}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {virtual ? (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                            {t.frequency}
                          </span>
                        ) : (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            t.status === "Completed"
                              ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                              : t.status === "In Progress"
                                ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                                : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300"
                          }`}>
                            {t.status}
                          </span>
                        )}
                        {t.area && (
                          <span className="text-xs text-gray-500 dark:text-neutral-400">{t.area}</span>
                        )}
                        {isOverdue && !virtual && (
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">Overdue</span>
                        )}
                        {t.costEstimate !== null && (
                          <span className="text-xs text-gray-400 dark:text-neutral-500">${t.costEstimate}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-neutral-600 flex-shrink-0 mt-0.5" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
