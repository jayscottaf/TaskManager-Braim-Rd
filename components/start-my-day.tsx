"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Clock, Plus, X } from "lucide-react";
import type { Task } from "@/lib/types";
import {
  addToHomePlan,
  emptyHomePlan,
  estimateTaskMinutes,
  localDateKey,
  MAX_PLAN_TASKS,
  PLAN_CHANGED_EVENT,
  PLAN_STORAGE_KEY,
  planSuggestions,
  readHomePlan,
  reconcileHomePlan,
  saveHomePlan,
  type HomePlan,
} from "@/lib/home-plan";
import { showToast } from "@/components/toast";
import { completionNotice } from "@/lib/completion-notice";
import { isUpcomingRepeat } from "@/lib/task-visibility";

const TIME_PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "2 hr", value: 120 },
];

export function StartMyDay({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [plan, setPlan] = useState<HomePlan>(emptyHomePlan);
  const [ready, setReady] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [editingEstimate, setEditingEstimate] = useState<string | null>(null);
  const [estimateDraft, setEstimateDraft] = useState("");
  const [message, setMessage] = useState("");
  const [schedulingPending, setSchedulingPending] = useState<string[]>([]);
  const completing = useRef<string | null>(null);
  const savedCompletions = useRef(new Set<string>());

  useEffect(() => {
    function restore() {
      const saved = readHomePlan();
      const reconciled = reconcileHomePlan(saved, tasks.filter((task) => !isUpcomingRepeat(task)));
      setPlan(reconciled);
      setReady(true);
      if (reconciled !== saved) {
        // Avoid re-entering our own change listener while persisting cleanup.
        try {
          localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(reconciled));
        } catch {
          setMessage(
            "Your plan is available now, but this browser could not save it for next time.",
          );
        }
      }
    }
    restore();
    window.addEventListener(PLAN_CHANGED_EVENT, restore);
    window.addEventListener("storage", restore);
    window.addEventListener("focus", restore);
    return () => {
      window.removeEventListener(PLAN_CHANGED_EVENT, restore);
      window.removeEventListener("storage", restore);
      window.removeEventListener("focus", restore);
    };
  }, [tasks]);

  function update(next: HomePlan) {
    setPlan(next);
    try {
      saveHomePlan(next);
    } catch {
      setMessage(
        "Your plan is available now, but this browser could not save it for next time.",
      );
    }
  }

  function commitBudget() {
    if (!customMinutes.trim()) return;
    const value = Number(customMinutes);
    if (!Number.isFinite(value) || value < 10 || value > 480) {
      setMessage("Choose between 10 and 480 minutes.");
      return;
    }
    update({ ...plan, budgetMinutes: Math.round(value) });
    setMessage("");
  }

  function addTask(task: Task) {
    const availablePlan = { ...plan, selectedIds: remainingTasks.map((selected) => selected.id) };
    const next = addToHomePlan(availablePlan, task.id);
    if (next === plan) return;
    update(next);
    setMessage(`Added ${task.task} to your plan.`);
  }

  function skipTask(task: Task) {
    update({
      ...plan,
      selectedIds: plan.selectedIds.filter((id) => id !== task.id),
      skippedDate: localDateKey(),
      skippedIds: [...new Set([...plan.skippedIds, task.id])],
    });
    setMessage(
      "Removed from today's suggestions. Its planned date is unchanged.",
    );
  }

  function commitEstimate(task: Task) {
    const minutes = Number(estimateDraft);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 1440) {
      setMessage("Choose a duration between 5 and 1,440 minutes.");
      return;
    }
    update({
      ...plan,
      estimates: { ...plan.estimates, [task.id]: Math.round(minutes) },
    });
    setEditingEstimate(null);
    setMessage("Duration saved for your plan on this device.");
  }

  async function markDone(task: Task) {
    if (completing.current || savedCompletions.current.has(task.id) || task.status === "Completed") return;
    completing.current = task.id;
    setActing(task.id);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({
          status: "Completed",
          dateCompleted: { start: localDateKey() },
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        saved?: boolean;
        error?: string;
        code?: string;
        nextOccurrence?: Task;
      } | null;
      if (!response.ok && result?.saved) {
        savedCompletions.current.add(task.id);
        setSchedulingPending((ids) => [...new Set([...ids, task.id])]);
        setCompletedIds((ids) => [...ids, task.id]);
        const notice =
          result.error ||
          "Completion saved, but the next repeat needs retrying. Open the task to finish scheduling.";
        setMessage(notice);
        showToast(notice, "error");
        router.refresh();
        return;
      }
      if (!response.ok && result?.code === "EARLY_RECURRENCE_COMPLETION") {
        setMessage("This is a future repeat. Open the task to review it before completing it early.");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error("Completion was not saved");
      savedCompletions.current.add(task.id);
      setCompletedIds((ids) => [...ids, task.id]);
      const notice = completionNotice(result?.nextOccurrence);
      setMessage(`${task.task}: ${notice}`);
      showToast(notice, "success");
      router.refresh();
    } catch {
      setMessage(
        "Could not save completion. Your task is unchanged. Please try again.",
      );
      showToast("Could not save completion. Please try again.", "error");
    } finally {
      completing.current = null;
      setActing(null);
    }
  }

  const selectedTasks = tasks.filter((task) =>
    plan.selectedIds.includes(task.id) && !isUpcomingRepeat(task),
  );
  const isDone = (task: Task) =>
    task.status === "Completed" || completedIds.includes(task.id);
  const remainingTasks = selectedTasks.filter((task) => !isDone(task));
  const totalMinutes = remainingTasks.reduce(
    (sum, task) => sum + (plan.estimates[task.id] ?? estimateTaskMinutes(task)),
    0,
  );
  const suggestions = planSuggestions(
    tasks.filter((task) => !completedIds.includes(task.id)),
    { ...plan, selectedIds: remainingTasks.map((task) => task.id) },
  );
  const finished = selectedTasks.length > 0 && remainingTasks.length === 0;
  const overBudget = totalMinutes > plan.budgetMinutes;

  function duration(task: Task) {
    const minutes = plan.estimates[task.id] ?? estimateTaskMinutes(task);
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        {editingEstimate === task.id ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              commitEstimate(task);
            }}
          >
            <label className="sr-only" htmlFor={`duration-${task.id}`}>
              Minutes for {task.task}
            </label>
            <input
              id={`duration-${task.id}`}
              autoFocus
              type="number"
              min="5"
              max="1440"
              value={estimateDraft}
              onChange={(event) => setEstimateDraft(event.target.value)}
              className="w-20 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-2 text-base"
            />
            <span>min</span>
            <button className="min-h-11 px-3 text-blue-600 dark:text-blue-400 font-semibold">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingEstimate(null)}
              className="min-h-11 px-2"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingEstimate(task.id);
              setEstimateDraft(String(minutes));
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-left underline decoration-neutral-300 underline-offset-4"
            aria-label={`Edit estimated duration for ${task.task}, currently ${minutes} minutes`}
          >
            <Clock className="h-3.5 w-3.5" />
            About {minutes} min · Edit
          </button>
        )}
        <Link
          href={`/task/${task.id}?returnTo=%2F`}
          className="inline-flex min-h-11 items-center px-2 underline decoration-neutral-300 underline-offset-4"
        >
          Reschedule
        </Link>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="your-plan-heading"
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="your-plan-heading"
            className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50"
          >
            Your plan
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Choose up to three tasks. Everything else is safely saved.
          </p>
        </div>
      </div>
      {!ready ? (
        <p className="mt-5 text-sm text-neutral-500" role="status">
          Loading your saved plan…
        </p>
      ) : (
        <>
          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
              How much time do you have?
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              {TIME_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.value}
                  aria-pressed={plan.budgetMinutes === preset.value}
                  onClick={() => {
                    setCustomMinutes("");
                    update({ ...plan, budgetMinutes: preset.value });
                  }}
                  className={`min-h-11 rounded-xl px-3 text-sm font-medium ${plan.budgetMinutes === preset.value ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"}`}
                >
                  {preset.label}
                </button>
              ))}
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                Custom
                <input
                  type="number"
                  min="10"
                  max="480"
                  aria-label="Custom available minutes"
                  placeholder="min"
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  onBlur={commitBudget}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  className="w-14 bg-transparent py-2 text-base text-neutral-900 focus:outline-none dark:text-neutral-100"
                />
              </label>
            </div>
          </fieldset>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            {totalMinutes} min planned · {plan.budgetMinutes} min available
            {overBudget
              ? ". You can remove a task or give yourself more time."
              : ""}
          </p>
          {selectedTasks.length === 0 && (
            <div className="mt-5 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/50">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                A small plan is enough.
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Add a suggestion below, or choose from your saved tasks.
              </p>
            </div>
          )}
          {finished && (
            <div className="mt-5 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/20">
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                You finished your plan.
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                You did what you chose to do. The rest can wait.
              </p>
              <button
                type="button"
                onClick={() => {
                  update({ ...plan, selectedIds: [] });
                  setCompletedIds([]);
                }}
                className="mt-2 min-h-11 text-sm font-semibold text-blue-600 dark:text-blue-400"
              >
                Start a new plan
              </button>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-3">
            {remainingTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => markDone(task)}
                    disabled={acting !== null || isDone(task)}
                    aria-label={`Complete ${task.task}`}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${isDone(task) ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300 text-neutral-500 dark:border-neutral-600"} disabled:opacity-60`}
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <Link
                    href={`/task/${task.id}?returnTo=%2F`}
                    className={`flex-1 py-2 text-sm font-semibold leading-relaxed text-neutral-900 dark:text-neutral-100 ${isDone(task) ? "line-through" : ""}`}
                  >
                    {task.task}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${task.task} from your plan`}
                    onClick={() => skipTask(task)}
                    disabled={acting !== null}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {!isDone(task) && duration(task)}
              </article>
            ))}
          </div>
          {!finished && remainingTasks.length < MAX_PLAN_TASKS && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                Suggestions that fit your time
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Rough estimates; adjust them to match the whole job.
              </p>
              {suggestions.length === 0 && (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  No whole task fits the remaining time. You can choose any
                  saved task or leave your plan as it is.
                </p>
              )}
              {suggestions.map((task) => (
                <article
                  key={task.id}
                  className="mt-3 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/50"
                >
                  <Link
                    href={`/task/${task.id}?returnTo=%2F`}
                    className="text-sm font-medium leading-relaxed text-neutral-900 dark:text-neutral-100"
                  >
                    {task.task}
                  </Link>
                  {duration(task)}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addTask(task)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-blue-600 dark:text-blue-400"
                    >
                      <Plus className="h-4 w-4" />
                      Add to plan
                    </button>
                    <button
                      type="button"
                      onClick={() => skipTask(task)}
                      className="min-h-11 rounded-lg px-3 text-sm text-neutral-500 dark:text-neutral-400"
                    >
                      Not today
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-sm text-neutral-500 dark:text-neutral-400"
      >
        {message}
      </p>
      {schedulingPending.map((id) => (
        <Link key={id} href={`/task/${id}?returnTo=%2F`} className="inline-flex min-h-11 items-center text-sm font-medium text-blue-600 dark:text-blue-400">
          Finish scheduling next repeat for {tasks.find((task) => task.id === id)?.task ?? "completed task"}
        </Link>
      ))}
    </section>
  );
}

/** Free completed or future repeat picks before adding work from the task list. */
export function HomePlanStorageSync({ tasks }: { tasks: Task[] }) {
  useEffect(() => {
    const saved = readHomePlan();
    const reconciled = reconcileHomePlan(saved, tasks.filter((task) => task.status !== "Completed" && !isUpcomingRepeat(task)));
    if (reconciled !== saved) {
      try {
        saveHomePlan(reconciled);
      } catch {
        /* No destructive storage fallback. */
      }
    }
  }, [tasks]);
  return null;
}
