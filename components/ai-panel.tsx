"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, X, Loader2, AlertCircle } from "lucide-react";
import type { AISuggestion } from "@/lib/ai";

export function AIPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    function handleOpen() { loadSuggestions(); }
    window.addEventListener("open-ai", handleOpen);
    return () => window.removeEventListener("open-ai", handleOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSuggestions() {
    setOpen(true);
    if (suggestions.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch("/api/ai/suggest", {
        headers: secret ? { "x-app-secret": secret } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `API returned ${res.status}`);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuggestions(data);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }

  async function addSuggestion(s: AISuggestion) {
    setAdding(s.task);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({
          task: s.task,
          area: s.area,
          type: s.types,
          priority: s.priority,
        }),
      });
      setSuggestions((prev) => prev.filter((x) => x.task !== s.task));
      router.refresh();
    } catch {
      // ignore
    } finally {
      setAdding(null);
    }
  }

  // No floating button — only triggered by bottom nav
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-neutral-900 rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col animate-slide-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-neutral-950 dark:text-neutral-50">AI Suggestions</h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5 text-neutral-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="ml-2 text-sm text-neutral-500">
              Analyzing your tasks...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
            <button
              onClick={() => { setSuggestions([]); loadSuggestions(); }}
              className="text-sm text-blue-600 font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <p className="text-neutral-400 text-sm">No new suggestions right now</p>
            <button
              onClick={() => { setSuggestions([]); loadSuggestions(); }}
              className="text-sm text-blue-600 font-medium hover:underline"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {suggestions.map((s) => (
              <div
                key={s.task}
                className="bg-white dark:bg-neutral-800 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-950 dark:text-neutral-50 text-sm">
                      {s.task}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">{s.reason}</p>
                    <div className="flex gap-1.5 mt-2">
                      <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded-md text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                        {s.area}
                      </span>
                      <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded-md text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                        {s.priority}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => addSuggestion(s)}
                    disabled={adding === s.task}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white flex-shrink-0 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {adding === s.task ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
