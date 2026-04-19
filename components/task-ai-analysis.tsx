"use client";

import { useState } from "react";
import { Sparkles, Loader2, Wrench, DollarSign, Phone, AlertTriangle, RefreshCw } from "lucide-react";
import type { TaskAnalysis } from "@/lib/ai";
import type { Task } from "@/lib/types";
import { showToast } from "@/components/toast";

export function TaskAIAnalysis({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TaskAnalysis | null>(null);

  async function run(force = false) {
    setLoading(true);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch("/api/ai/analyze-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({ id: task.id, force }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data: TaskAnalysis = await res.json();
      setAnalysis(data);
      setOpen(true);
    } catch {
      showToast("Failed to analyze task. Try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="mx-5">
        <button
          onClick={() => run(false)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/40 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Analyzing..." : "Get AI analysis"}
        </button>
      </div>
    );
  }

  if (!analysis) return null;

  const diyColor = analysis.diyGuidance.recommendation === "DIY"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
    : analysis.diyGuidance.recommendation === "Hire a pro"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
    : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";

  const costColor = analysis.costSanityCheck.estimateIsReasonable
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
    : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";

  return (
    <div className="mx-5 flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-500" />
          AI Analysis
        </h3>
        <button
          onClick={() => run(true)}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Regenerate
        </button>
      </div>

      {/* DIY Guidance */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="w-4 h-4 text-neutral-500" />
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">DIY Guidance</p>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${diyColor}`}>
            {analysis.diyGuidance.recommendation}
          </span>
        </div>
        <p className="text-sm text-neutral-800 dark:text-neutral-200 mb-3">{analysis.diyGuidance.reasoning}</p>
        {analysis.diyGuidance.steps.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1.5">Steps</p>
            <ol className="list-decimal list-inside flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
              {analysis.diyGuidance.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}
        {analysis.diyGuidance.materials.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1.5">Materials & Tools</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.diyGuidance.materials.map((m, i) => (
                <span key={i} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-md text-xs">{m}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cost Sanity Check */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-neutral-500" />
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Cost Check</p>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${costColor}`}>
            {analysis.costSanityCheck.estimateIsReasonable ? "Reasonable" : "Off the mark"}
          </span>
        </div>
        <p className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1">
          ${analysis.costSanityCheck.expectedRange.low.toLocaleString()} – ${analysis.costSanityCheck.expectedRange.high.toLocaleString()}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{analysis.costSanityCheck.note}</p>
      </div>

      {/* Contractor Advice */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-4 h-4 text-neutral-500" />
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Contractor Advice</p>
        </div>
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-3">
          Trade: <span className="font-normal text-neutral-700 dark:text-neutral-300">{analysis.contractorAdvice.tradeType}</span>
        </p>
        {analysis.contractorAdvice.questionsToAsk.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1.5">Questions to Ask</p>
            <ul className="list-disc list-inside flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
              {analysis.contractorAdvice.questionsToAsk.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}
        {analysis.contractorAdvice.redFlags.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              Red Flags
            </p>
            <ul className="list-disc list-inside flex flex-col gap-1 text-sm text-red-600 dark:text-red-400">
              {analysis.contractorAdvice.redFlags.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
