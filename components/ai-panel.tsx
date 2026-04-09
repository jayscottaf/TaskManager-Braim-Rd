"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, X, Loader2 } from "lucide-react";
import type { AISuggestion } from "@/lib/ai";

export function AIPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  async function loadSuggestions() {
    setOpen(true);
    if (suggestions.length > 0) return;
    setLoading(true);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch("/api/ai/suggest", {
        headers: secret ? { "x-app-secret": secret } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setSuggestions(data);
      }
    } catch {
      // ignore
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

  if (!open) {
    return (
      <button
        onClick={loadSuggestions}
        className="fixed bottom-20 right-4 bg-neutral-950 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 hover:bg-neutral-800 active:scale-[0.98] transition-all z-40"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">AI Suggestions</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col animate-slide-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-neutral-950">AI Suggestions</h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
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
        ) : suggestions.length === 0 ? (
          <p className="text-center text-neutral-400 py-8 text-sm">
            No new suggestions right now
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {suggestions.map((s) => (
              <div
                key={s.task}
                className="bg-white rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-950 text-sm">
                      {s.task}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">{s.reason}</p>
                    <div className="flex gap-1.5 mt-2">
                      <span className="px-2 py-0.5 bg-neutral-100 rounded-md text-[11px] text-neutral-500 font-medium">
                        {s.area}
                      </span>
                      <span className="px-2 py-0.5 bg-neutral-100 rounded-md text-[11px] text-neutral-500 font-medium">
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
