"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ChevronRight, Calendar, MapPin, Plus, Repeat } from "lucide-react";
import type { Task, Priority, Status } from "@/lib/types";
import { PRIORITIES, STATUSES } from "@/lib/types";
import {
  addToHomePlan,
  isOverdueDeadline,
  MAX_PLAN_TASKS,
  readHomePlan,
  saveHomePlan,
  taskDateKey,
} from "@/lib/home-plan";
import { showToast } from "@/components/toast";

export function TaskCard({ task }: { task: Task }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const taskHref = `/task/${task.id}?returnTo=${encodeURIComponent(returnTo)}`;
  const [priority, setPriority] = useState<Priority | null>(task.priority);
  const [status, setStatus] = useState<Status>(task.status);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const overdue = isOverdueDeadline({ ...task, status });
  const date = taskDateKey(task);

  async function updateField(field: "priority" | "status", value: string) {
    const previousPriority = priority;
    const previousStatus = status;
    if (field === "priority") setPriority(value as Priority);
    else setStatus(value as Status);
    setPending(true);
    setMessage("Saving…");
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({ [field]: value }),
      });
      const result = (await response.json().catch(() => null)) as {
        saved?: boolean;
        error?: string;
      } | null;
      if (!response.ok && result?.saved) {
        const notice =
          result.error ||
          "Task saved, but the next repeat needs retrying. Open the task to finish scheduling.";
        setMessage(notice);
        showToast(notice, "error");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error("Update was not saved");
      setMessage("Saved.");
      router.refresh();
    } catch {
      setPriority(previousPriority);
      setStatus(previousStatus);
      setMessage(
        "Could not save. Your previous value has been restored. Please try again.",
      );
      showToast("Could not save task. Please try again.", "error");
    } finally {
      setPending(false);
    }
  }

  function addToPlan() {
    const plan = readHomePlan();
    if (plan.selectedIds.includes(task.id)) {
      showToast("Already in your plan", "info");
      return;
    }
    if (plan.selectedIds.length >= MAX_PLAN_TASKS) {
      showToast(
        "Your plan has three tasks. Remove one before adding another.",
        "info",
      );
      return;
    }
    try {
      saveHomePlan(addToHomePlan(plan, task.id));
      showToast("Added to your plan", "success");
    } catch {
      showToast(
        "Could not save your plan on this device. Please try again.",
        "error",
      );
    }
  }

  return (
    <article
      aria-busy={pending}
      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <Link href={taskHref} className="group block rounded-lg py-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 break-words text-base font-semibold leading-relaxed text-neutral-950 dark:text-neutral-50">
            {task.task}
          </h3>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-neutral-400" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
          {task.area && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {task.area}
            </span>
          )}
          {date && (
            <span
              className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-red-600 dark:text-red-400" : ""}`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {overdue
                ? "Deadline passed: "
                : task.isDeadline
                  ? "Deadline: "
                  : "Planned for "}
              {format(parseISO(date), "MMM d, yyyy")}
            </span>
          )}
          {task.frequency && task.frequency !== "One-time" && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="h-3.5 w-3.5" />
              {task.frequency}
            </span>
          )}
        </div>
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label={`Priority for ${task.task}`}
          value={priority || ""}
          disabled={pending}
          onChange={(event) => updateField("priority", event.target.value)}
          className="min-h-11 max-w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs text-neutral-600 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        >
          <option value="" disabled>
            Priority
          </option>
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value} priority
            </option>
          ))}
        </select>
        <select
          aria-label={`Status for ${task.task}`}
          value={status}
          disabled={pending}
          onChange={(event) => updateField("status", event.target.value)}
          className="min-h-11 max-w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs text-neutral-600 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {status !== "Completed" && (
          <button
            type="button"
            onClick={addToPlan}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add to plan
          </button>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="mt-1 text-xs text-neutral-500 dark:text-neutral-400"
      >
        {message}
      </p>
    </article>
  );
}
