"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isPast, isWithinInterval, addDays } from "date-fns";
import { ChevronRight, Calendar, DollarSign, MapPin } from "lucide-react";
import type { Task, Priority, Status } from "@/lib/types";
import { PRIORITIES, STATUSES } from "@/lib/types";

const PRIORITY_COLORS: Record<Priority, string> = {
  High: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
};

const STATUS_COLORS: Record<Status, string> = {
  "Not Started": "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  "On Hold": "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
};

function DueDateLabel({ dueDate, status }: { dueDate: Task["dueDate"]; status: string }) {
  if (!dueDate) return null;
  const date = new Date(dueDate.start + "T00:00:00");
  const now = new Date();
  const overdue = status !== "Completed" && isPast(date) && dueDate.start < format(now, "yyyy-MM-dd");
  const dueSoon = isWithinInterval(date, { start: now, end: addDays(now, 3) });

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        overdue
          ? "text-red-600 font-semibold"
          : dueSoon
            ? "text-orange-600"
            : "text-neutral-500"
      }`}
    >
      <Calendar className="w-3 h-3" />
      {overdue ? "Overdue: " : ""}
      {format(date, "MMM d")}
      {dueDate.end ? ` – ${format(new Date(dueDate.end + "T00:00:00"), "MMM d")}` : ""}
    </span>
  );
}

function InlineSelect<T extends string>({
  value,
  options,
  colors,
  onChange,
}: {
  value: T | null;
  options: readonly T[];
  colors: Record<string, string>;
  onChange: (val: T) => void;
}) {
  return (
    <select
      value={value || ""}
      onClick={(e) => e.preventDefault()}
      onChange={(e) => {
        e.preventDefault();
        onChange(e.target.value as T);
      }}
      className={`appearance-none cursor-pointer px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border pr-5 bg-[length:12px] bg-[right_2px_center] bg-no-repeat ${
        value ? colors[value] : "bg-neutral-100 text-neutral-500 border-neutral-200"
      }`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23999'%3E%3Cpath d='M4.5 6l3.5 4 3.5-4z'/%3E%3C/svg%3E")`,
      }}
    >
      {!value && <option value="">—</option>}
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export function TaskCard({ task }: { task: Task }) {
  const router = useRouter();
  const [priority, setPriority] = useState<Priority | null>(task.priority);
  const [status, setStatus] = useState<Status>(task.status);

  async function updateField(field: string, value: string) {
    const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-app-secret": secret } : {}),
      },
      body: JSON.stringify({ [field]: value }),
    });
    router.refresh();
  }

  function handlePriorityChange(val: Priority) {
    setPriority(val);
    updateField("priority", val);
  }

  function handleStatusChange(val: Status) {
    setStatus(val);
    updateField("status", val);
  }

  return (
    <Link
      href={`/task/${task.id}`}
      className="group block bg-white dark:bg-neutral-900 rounded-2xl shadow-sm hover:shadow-md dark:shadow-neutral-900/50 p-5 transition-all duration-200 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <InlineSelect
              value={priority}
              options={PRIORITIES}
              colors={PRIORITY_COLORS}
              onChange={handlePriorityChange}
            />
            <InlineSelect
              value={status}
              options={STATUSES}
              colors={STATUS_COLORS}
              onChange={handleStatusChange}
            />
          </div>
          <h3 className="text-[15px] font-semibold text-neutral-950 dark:text-neutral-50 truncate">{task.task}</h3>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {task.area && (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                <MapPin className="w-3 h-3" />
                {task.area}
                {task.subLocation ? ` · ${task.subLocation}` : ""}
              </span>
            )}
            <DueDateLabel dueDate={task.dueDate} status={status} />
            {task.costEstimate !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                <DollarSign className="w-3 h-3" />
                {task.costEstimate.toLocaleString()}
              </span>
            )}
          </div>

          {task.type.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {task.type.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-md text-[11px] font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </Link>
  );
}
