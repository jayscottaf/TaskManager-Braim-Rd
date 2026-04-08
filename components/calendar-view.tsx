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
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task, Priority } from "@/lib/types";
import Link from "next/link";

const DOT_COLORS: Record<Priority, string> = {
  High: "bg-red-500",
  Medium: "bg-yellow-500",
  Low: "bg-green-500",
};

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  function getTasksForDay(day: Date): Task[] {
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
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
    [selectedDate, tasks]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-full active:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-900">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-full active:bg-gray-100"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
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

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-2 gap-px">
        {days.map((day) => {
          const dayTasks = getTasksForDay(day);
          const isInMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() =>
                setSelectedDate(
                  selectedDate && isSameDay(day, selectedDate) ? null : day
                )
              }
              className={`flex flex-col items-center py-1.5 min-h-[44px] rounded-lg transition-colors ${
                isSelected
                  ? "bg-gray-900 text-white"
                  : isToday
                    ? "bg-blue-50 text-blue-700"
                    : isInMonth
                      ? "text-gray-900 active:bg-gray-100"
                      : "text-gray-300"
              }`}
            >
              <span className="text-sm font-medium">{format(day, "d")}</span>
              {dayTasks.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayTasks.slice(0, 3).map((t, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected
                          ? "bg-white/70"
                          : DOT_COLORS[t.priority || "Low"]
                      }`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day tasks */}
      {selectedDate && (
        <div className="px-4 mt-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            {format(selectedDate, "EEEE, MMM d")}
          </h3>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-gray-400">No tasks on this day</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/task/${t.id}`}
                  className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2.5 active:bg-gray-50"
                >
                  {t.priority && (
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[t.priority]}`}
                    />
                  )}
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {t.task}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                    {t.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
