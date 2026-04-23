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
      <div className="mx-5 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 text-white/80">
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

  return (
    <div className="mx-5 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 rounded-2xl p-5 shadow-lg animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-white font-semibold text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Start My Day
          </h2>
          <p className="text-blue-100 text-xs mt-0.5">{focus.greeting}</p>
        </div>
        <span className="text-blue-200 text-[10px] font-medium bg-white/10 px-2 py-0.5 rounded-full">
          ~{totalMinutes} min
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {visibleTasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{t.task}</p>
              <p className="text-blue-200 text-[11px]">{t.reason} · ~{t.estimatedMinutes} min</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => markDone(t.id)}
                disabled={acting === t.id}
                className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                title="Done"
              >
                {acting === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => snooze(t.id)}
                disabled={acting === t.id}
                className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-amber-500 transition-colors disabled:opacity-50"
                title="Snooze to tomorrow"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setHidden((prev) => new Set(prev).add(t.id))}
                className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
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
