"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, X, Loader2 } from "lucide-react";
import type { AISuggestion } from "@/lib/ai";
import { requestJson, taskRequestHeaders } from "@/lib/client-request";
import { useModalFocus } from "@/components/use-modal-focus";
import { showToast } from "@/components/toast";

export function AIPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useModalFocus(open, panel, close);
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-ai", handleOpen);
    return () => window.removeEventListener("open-ai", handleOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(null);
      try {
        const data = await requestJson<AISuggestion[]>("/api/ai/suggest", { headers: taskRequestHeaders(), signal: controller.signal });
        if (!Array.isArray(data)) throw new Error("Couldn't read maintenance ideas.");
        if (!controller.signal.aborted) setSuggestions(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Couldn't load ideas. Please try again.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [open, reload]);

  async function addSuggestion(suggestion: AISuggestion) {
    if (adding) return;
    setAdding(suggestion.task); setError(null);
    try {
      await requestJson("/api/tasks", { method: "POST", headers: taskRequestHeaders(), body: JSON.stringify({ task: suggestion.task, area: suggestion.area, type: suggestion.types, priority: suggestion.priority }) });
      setSuggestions((previous) => previous.filter((item) => item.task !== suggestion.task));
      showToast("Saved to your tasks. Plan it when you're ready.", "success");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't save this idea. Try again."); }
    finally { setAdding(null); }
  }
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={close}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="ideas-title" tabIndex={-1} onClick={(event) => event.stopPropagation()} className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-line bg-surface sm:rounded-3xl">
      <div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 id="ideas-title" className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-accent" />Maintenance ideas</h2><button type="button" onClick={close} aria-label="Close ideas" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted"><X className="h-5 w-5" /></button></div>
      <div className="overflow-y-auto space-y-4 px-5 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <p className="text-sm text-muted">Optional ideas for your home. Add only what you want to keep.</p>
        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-warning">{error}<button type="button" onClick={() => setReload((value) => value + 1)} className="ml-2 min-h-11 underline">Try again</button></div>}
        {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted"><Loader2 className="h-5 w-5 animate-spin" />Finding ideas…</p>
          : suggestions.length === 0 ? <p className="py-8 text-sm text-muted">No new ideas right now. Your saved tasks are still available.</p>
          : suggestions.map((item) => <div key={item.task} className="flex items-start gap-3 rounded-2xl border border-line p-4"><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{item.task}</h3><p className="mt-1 text-sm text-muted">{item.reason}</p><p className="mt-2 text-xs text-muted">{item.area}</p></div><button type="button" onClick={() => addSuggestion(item)} disabled={Boolean(adding)} aria-label={`Save ${item.task}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent disabled:opacity-50">{adding === item.task ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}</button></div>)}
      </div>
    </div>
  </div>;
}
