"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Check, Clock, EyeOff, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { DailyFocus } from "@/lib/ai";
import { showToast } from "@/components/toast";

const TIME_PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "2 hr", value: 120 },
] as const;

export function StartMyDay() {
  const router = useRouter();
  const [focus, setFocus] = useState<DailyFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [budgetMinutes, setBudgetMinutes] = useState(30);
  const [customMinutes, setCustomMinutes] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setHidden(new Set());
        const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
        const res = await fetch(`/api/ai/start-my-day?minutes=${budgetMinutes}`, {
          headers: secret ? { "x-app-secret": secret } : {},
        });
        if (res.ok) setFocus(await res.json());
      } catch {
        // silent fail — Start My Day is a bonus feature
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [budgetMinutes]);

  async function markDone(taskId: string) {
    setActing(taskId);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(secret ? { "x-app-secret": secret } : {}) },
        body: JSON.stringify({ status: "Completed", dateCompleted: { start: new Date().toISOString().split("T")[0] } }),
      });
      setHidden((prev) => new Set(prev).add(taskId));
      showToast("Task completed!", "success");
      router.refresh();
    } catch {
      showToast("Failed to complete task.", "error");
    } finally {
      setActing(null);
    }
  }

  async function snooze(taskId: string) {
    setActing(taskId);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(secret ? { "x-app-secret": secret } : {}) },
        body: JSON.stringify({ dueDate: { start: tomorrow.toISOString().split("T")[0] } }),
      });
      setHidden((prev) => new Set(prev).add(taskId));
      showToast("Snoozed to tomorrow", "info");
      router.refresh();
    } catch {
      showToast("Failed to snooze task.", "error");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Planning your day...</span>
        </div>
      </div>
    );
  }

  if (!focus) return null;

  const visibleTasks = focus.tasks.filter((t) => !hidden.has(t.id));
  const totalMinutes = visibleTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const remainingMinutes = Math.max(0, budgetMinutes - totalMinutes);

  function fmtTime(mins: number): string {
    if (mins >= 60) return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
    return `${mins} min`;
  }

  function setBudget(value: number) {
    setBudgetMinutes(value);
    setCustomMinutes("");
  }

  function applyCustomMinutes(value: string) {
    setCustomMinutes(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 480) {
      setBudgetMinutes(Math.round(parsed));
    }
  }

  const budgetControls = (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setBudget(preset.value)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
              budgetMinutes === preset.value && !customMinutes
                ? "bg-blue-600 text-white"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
          Custom
          <input
            type="number"
            min="10"
            max="480"
            value={customMinutes}
            onChange={(e) => applyCustomMinutes(e.target.value)}
            placeholder="min"
            className="w-12 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
          />
        </label>
      </div>
      <div className="flex items-center justify-between text-[11px] text-neutral-400">
        <span>{fmtTime(budgetMinutes)} available</span>
        <span>{fmtTime(totalMinutes)} planned - {fmtTime(remainingMinutes)} open</span>
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <div className="mx-5">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <span className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
            <Sparkles className="w-4 h-4 text-blue-500" />
            Start My Day - {fmtTime(totalMinutes)} planned in {fmtTime(budgetMinutes)}
          </span>
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-neutral-900 dark:text-neutral-50 font-semibold text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-500" />
            Start My Day
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5">{focus.greeting}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full whitespace-nowrap">
            {fmtTime(totalMinutes)} / {fmtTime(budgetMinutes)}
          </span>
          <button
            onClick={() => setCollapsed(true)}
            className="text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors"
            title="Collapse"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {budgetControls}

      {visibleTasks.length === 0 && (
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 px-3 py-4 text-center">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">No good fit for {fmtTime(budgetMinutes)}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Try 30 minutes or snooze a task.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visibleTasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
          >
            <Link href={`/task/${t.id}`} className="flex-1 min-w-0 -my-2.5 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-neutral-900 dark:text-neutral-50 text-sm font-medium truncate">{t.task}</p>
                <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300 text-[10px] font-semibold flex-shrink-0">
                  {t.impactLabel}
                </span>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">{t.reason} - ~{fmtTime(t.estimatedMinutes)}</p>
            </Link>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => markDone(t.id)}
                disabled={acting === t.id}
                className="p-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-emerald-500 hover:text-white transition-colors disabled:opacity-50"
                title="Done"
              >
                {acting === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => snooze(t.id)}
                disabled={acting === t.id}
                className="p-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-50"
                title="Snooze to tomorrow"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setHidden((prev) => new Set(prev).add(t.id))}
                className="p-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                title="Not today"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
