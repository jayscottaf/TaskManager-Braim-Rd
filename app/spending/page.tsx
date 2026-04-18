export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { getTasks } from "@/lib/notion";
import { ErrorDetails } from "@/components/error-details";
import type { Task } from "@/lib/types";

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

type Aggregate = { label: string; actual: number; estimate: number; count: number };

function aggregateBy<K extends string>(tasks: Task[], getKey: (t: Task) => K | null): Aggregate[] {
  const map = new Map<string, Aggregate>();
  for (const t of tasks) {
    const key = getKey(t);
    if (!key) continue;
    const entry = map.get(key) ?? { label: key, actual: 0, estimate: 0, count: 0 };
    entry.actual += t.actualCost ?? 0;
    entry.estimate += t.costEstimate ?? 0;
    entry.count += 1;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.actual - a.actual);
}

function BarRow({ label, value, max, subtitle }: { label: string; value: number; max: number; subtitle?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-700 dark:text-neutral-200">{label}</span>
        <span className="font-semibold text-neutral-900 dark:text-neutral-50">{formatMoney(value)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {subtitle && <p className="text-[10px] text-neutral-400">{subtitle}</p>}
    </div>
  );
}

export default async function SpendingPage() {
  let tasks: Task[] = [];
  let errorState: { message?: string; code?: string } | null = null;

  try {
    tasks = await getTasks({ status: "Completed" });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    errorState = { message: e.message, code: e.code };
  }

  if (errorState) {
    return (
      <div className="pt-6 pb-24">
        <div className="px-5 flex items-center gap-3 mb-5">
          <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Spending</h1>
        </div>
        <div className="mx-5 p-5 bg-red-50 dark:bg-red-950/30 rounded-2xl">
          <p className="font-semibold text-red-700 dark:text-red-400">Having trouble connecting</p>
          <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">Try refreshing in a moment.</p>
          <ErrorDetails message={errorState.message} code={errorState.code} />
        </div>
      </div>
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  // Year-to-date filter: tasks completed this year
  const ytdTasks = tasks.filter((t) => {
    if (!t.dateCompleted?.start) return false;
    return new Date(t.dateCompleted.start).getFullYear() === currentYear;
  });

  const ytdTotal = ytdTasks.reduce((sum, t) => sum + (t.actualCost ?? 0), 0);
  const ytdEstimated = ytdTasks.reduce((sum, t) => sum + (t.costEstimate ?? 0), 0);
  const estimateVariance = ytdEstimated > 0 ? ((ytdTotal - ytdEstimated) / ytdEstimated) * 100 : 0;

  const byArea = aggregateBy(ytdTasks, (t) => t.area);
  const byType = aggregateBy(ytdTasks, (t) => t.type[0] ?? null);
  const maxAreaValue = Math.max(1, ...byArea.map((a) => a.actual));
  const maxTypeValue = Math.max(1, ...byType.map((a) => a.actual));

  // Monthly trend: last 12 months
  const monthlyTotals: { month: string; label: string; actual: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const total = tasks
      .filter((t) => {
        if (!t.dateCompleted?.start) return false;
        return t.dateCompleted.start.startsWith(key);
      })
      .reduce((sum, t) => sum + (t.actualCost ?? 0), 0);
    monthlyTotals.push({ month: key, label, actual: total });
  }
  const maxMonthly = Math.max(1, ...monthlyTotals.map((m) => m.actual));

  return (
    <div className="flex flex-col gap-6 pt-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="px-5 flex items-center gap-3">
        <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Spending</h1>
          <p className="text-sm text-neutral-400">{currentYear} · {ytdTasks.length} completed task{ytdTasks.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {ytdTasks.length === 0 ? (
        <div className="text-center py-16 mx-5">
          <DollarSign className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">No spending yet this year</p>
          <p className="text-sm text-neutral-400 mt-1">Complete tasks with an actual cost to see spending here.</p>
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="mx-5 grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">YTD Spent</p>
              <p className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">{formatMoney(ytdTotal)}</p>
              <p className="text-[11px] text-neutral-400 mt-1">Estimated: {formatMoney(ytdEstimated)}</p>
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">vs. Estimate</p>
              <p className={`text-2xl font-bold flex items-center gap-1 ${estimateVariance > 10 ? "text-red-600" : estimateVariance < -10 ? "text-emerald-600" : "text-neutral-950 dark:text-neutral-50"}`}>
                {estimateVariance > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {Math.abs(Math.round(estimateVariance))}%
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">
                {estimateVariance > 0 ? "over budget" : "under budget"}
              </p>
            </div>
          </div>

          {/* Monthly trend */}
          <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-3">Monthly Trend</p>
            <div className="flex items-end justify-between gap-1 h-24">
              {monthlyTotals.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full bg-blue-500 dark:bg-blue-400 rounded-t"
                      style={{ height: `${(m.actual / maxMonthly) * 100}%`, minHeight: m.actual > 0 ? "2px" : "0" }}
                      title={`${m.label}: ${formatMoney(m.actual)}`}
                    />
                  </div>
                  <span className="text-[9px] text-neutral-400 font-medium">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Area */}
          {byArea.length > 0 && (
            <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-3">By Area</p>
              <div className="flex flex-col gap-3">
                {byArea.map((a) => (
                  <BarRow
                    key={a.label}
                    label={a.label}
                    value={a.actual}
                    max={maxAreaValue}
                    subtitle={`${a.count} task${a.count > 1 ? "s" : ""}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* By Type */}
          {byType.length > 0 && (
            <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-3">By Type</p>
              <div className="flex flex-col gap-3">
                {byType.map((a) => (
                  <BarRow
                    key={a.label}
                    label={a.label}
                    value={a.actual}
                    max={maxTypeValue}
                    subtitle={`${a.count} task${a.count > 1 ? "s" : ""}`}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
