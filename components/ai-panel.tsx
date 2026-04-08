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
        className="fixed bottom-20 right-4 bg-purple-600 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 active:bg-purple-700 transition-colors z-40"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">AI Suggestions</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-gray-900">AI Suggestions</h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded-full active:bg-gray-100"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">
              Analyzing your tasks...
            </span>
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            No new suggestions right now
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {suggestions.map((s) => (
              <div
                key={s.task}
                className="bg-gray-50 rounded-xl p-3 border border-gray-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 text-sm">
                      {s.task}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>
                    <div className="flex gap-1 mt-1.5">
                      <span className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-600">
                        {s.area}
                      </span>
                      <span className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-600">
                        {s.priority}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => addSuggestion(s)}
                    disabled={adding === s.task}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white flex-shrink-0 active:bg-purple-700 disabled:opacity-50"
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
