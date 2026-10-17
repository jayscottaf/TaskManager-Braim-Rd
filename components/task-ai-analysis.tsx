"use client";

import { useState } from "react";
import { Sparkles, Loader2, Wrench, DollarSign, RefreshCw } from "lucide-react";
import type { TaskAnalysis } from "@/lib/ai";
import type { Task } from "@/lib/types";
import { requestJson, taskRequestHeaders } from "@/lib/client-request";
import { parseTaskNotes } from "@/lib/task-notes";
import { showToast } from "@/components/toast";
import { isTaskAnalysis } from "@/lib/task-analysis";

type Changes = { costEstimate?: number; workMode?: "DIY" | "Contractor" };

export function TaskAIAnalysis({ task, onAnalysis, onApply }: { task: Task; onAnalysis?: (analysis: TaskAnalysis) => void; onApply?: (changes: Changes) => void }) {
  const [result, setResult] = useState<{ id: string; analysis: TaskAnalysis } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let stored: TaskAnalysis | null = null;
  try {
    const parsed: unknown = JSON.parse(parseTaskNotes(task.notes).analysis || "null");
    if (isTaskAnalysis(parsed)) stored = parsed;
  } catch { /* Old or incomplete guidance can be regenerated. */ }
  const analysis = result?.id === task.id ? result.analysis : stored;

  async function run(force = false) {
    setLoading(true); setError(null);
    try {
      const data = await requestJson<unknown>("/api/ai/analyze-task", { method: "POST", headers: taskRequestHeaders(), body: JSON.stringify({ id: task.id, force }) });
      if (!isTaskAnalysis(data)) throw new Error("The guidance was incomplete. Please try again.");
      setResult({ id: task.id, analysis: data });
      onAnalysis?.(data);
      showToast("Guidance added to your draft. Save the task to keep it.", "info");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't load guidance. Please try again."); }
    finally { setLoading(false); }
  }

  const suggestion: Changes = {};
  if (analysis) {
    if (!analysis.costSanityCheck.estimateIsReasonable || task.costEstimate == null) {
      const { low, high } = analysis.costSanityCheck.expectedRange;
      if (high > 0) suggestion.costEstimate = Math.round((low + high) / 2);
    }
    if (!task.workMode && analysis.diyGuidance.recommendation !== "Either works") suggestion.workMode = analysis.diyGuidance.recommendation === "DIY" ? "DIY" : "Contractor";
  }
  return <details className="mx-5 rounded-2xl border border-line bg-surface">
    <summary className="flex min-h-14 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent" />Optional project guidance<span className="ml-auto text-xs font-normal text-muted">AI estimates</span></summary>
    <div className="space-y-4 border-t border-line p-4">
      <p className="text-xs leading-relaxed text-muted">Guidance uses the saved task. Save your edits first for an updated assessment. Estimates need checking against your home&apos;s condition and actual quotes.</p>
      <button type="button" onClick={() => run(Boolean(analysis))} disabled={loading} className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : analysis ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}{loading ? "Preparing guidance…" : analysis ? "Refresh guidance" : "Get guidance"}
      </button>
      {error && <p role="alert" className="text-sm text-warning">{error}</p>}
      {analysis && <>
        <section className="space-y-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4" />{analysis.diyGuidance.recommendation}</h3><p className="text-sm text-muted">{analysis.diyGuidance.reasoning}</p>
          {analysis.diyGuidance.steps.length > 0 && <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">{analysis.diyGuidance.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}
          {analysis.diyGuidance.materials.length > 0 && <p className="text-xs text-muted">Materials: {analysis.diyGuidance.materials.join(", ")}</p>}
        </section>
        <section className="space-y-2 border-t border-line pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><DollarSign className="h-4 w-4" />Estimated range</h3><p className="text-xl font-semibold">${analysis.costSanityCheck.expectedRange.low.toLocaleString()}–${analysis.costSanityCheck.expectedRange.high.toLocaleString()}</p><p className="text-sm text-muted">{analysis.costSanityCheck.note}</p>
          {onApply && Object.keys(suggestion).length > 0 && <button type="button" onClick={() => { onApply(suggestion); showToast("Suggestions added to your draft. Save when ready.", "info"); }} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium text-accent">Apply suggestions to draft</button>}
        </section>
        <details className="border-t border-line pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Questions for a contractor</summary><p className="mb-2 text-sm text-muted">{analysis.contractorAdvice.tradeType}</p><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{analysis.contractorAdvice.questionsToAsk.map((q, i) => <li key={i}>{q}</li>)}</ul>
          {analysis.contractorAdvice.redFlags.length > 0 && <><p className="mb-1 mt-3 text-sm font-medium">Things to check</p><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{analysis.contractorAdvice.redFlags.map((q, i) => <li key={i}>{q}</li>)}</ul></>}
        </details>
      </>}
    </div>
  </details>;
}
