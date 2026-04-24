"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Clock, X, Loader2 } from "lucide-react";
import type { DailyFocus } from "@/lib/ai";
import { showToast } from "@/components/toast";

export function StartMyDay() {
  const router = useRouter();
  const [focus, setFocus] = useState<DailyFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
        const res = await fetch("/api/ai/start-my-day", {
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
  }, []);

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

  if (!focus || focus.tasks.length === 0) return null;

  const visibleTasks = focus.tasks.filter((t) => !hidden.has(t.id));
  if (visibleTasks.length === 0) return null;

  const totalMinutes = visibleTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  function fmtTime(mins: number): string {
    if (mins >= 60) return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
    return `${mins} min`;
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
        <span className="text-neutral-400 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
          ~{fmtTime(totalMinutes)}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {visibleTasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-neutral-900 dark:text-neutral-50 text-sm font-medium truncate">{t.task}</p>
              <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">{t.reason} · ~{fmtTime(t.estimatedMinutes)}</p>
            </div>
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
                title="Skip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
