export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle,
  ClipboardList,
  DollarSign,
  Heart,
  PiggyBank,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { getTasks } from "@/lib/notion";
import { getActiveCost, getActiveRoi, getWishListItems } from "@/lib/wishlist";
import { ErrorDetails } from "@/components/error-details";
import { PageMenu } from "@/components/page-menu";
import type { Task } from "@/lib/types";
import type { WishListItem } from "@/lib/wishlist";

type Aggregate = { label: string; value: number; estimate: number; count: number };
type MoneyCardTone = "blue" | "emerald" | "amber" | "red" | "neutral";

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function formatPercent(n: number | null): string {
  return n == null || Number.isNaN(n) ? "n/a" : `${Math.round(n)}%`;
}

function dateValue(date?: { start: string; end?: string } | null): number | null {
  if (!date?.start) return null;
  const value = new Date(date.start).getTime();
  return Number.isNaN(value) ? null : value;
}

function effectiveCompletedValue(task: Task, fallback: Date): number | null {
  return dateValue(task.dateCompleted) ?? fallback.getTime();
}

function daysFromNow(date?: { start: string; end?: string } | null, now = new Date()): number | null {
  const value = dateValue(date);
  if (value == null) return null;
  return Math.ceil((value - now.getTime()) / 86_400_000);
}

function completedSpend(tasks: Task[], after: Date, fallbackDate: Date): number {
  return tasks
    .filter((t) => {
      const completed = effectiveCompletedValue(t, fallbackDate);
      return completed != null && completed >= after.getTime() && completedCost(t) > 0;
    })
    .reduce((sum, t) => sum + completedCost(t), 0);
}

function completedCost(task: Task): number {
  return task.actualCost ?? task.costEstimate ?? 0;
}

function usesEstimateFallback(task: Task): boolean {
  return task.actualCost == null && (task.costEstimate ?? 0) > 0;
}

function aggregateBy<K extends string>(
  rows: { key: K | null; value: number; estimate?: number }[]
): Aggregate[] {
  const map = new Map<string, Aggregate>();
  for (const row of rows) {
    if (!row.key || row.value <= 0) continue;
    const entry = map.get(row.key) ?? { label: row.key, value: 0, estimate: 0, count: 0 };
    entry.value += row.value;
    entry.estimate += row.estimate ?? 0;
    entry.count += 1;
    map.set(row.key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function MoneyCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: MoneyCardTone;
}) {
  const toneClass: Record<MoneyCardTone, string> = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">{label}</p>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="text-2xl font-bold text-neutral-950 dark:text-neutral-50 mt-2">{value}</p>
      <p className="text-xs text-neutral-400 mt-1 leading-snug">{detail}</p>
    </div>
  );
}

function BarRow({ label, value, max, subtitle }: { label: string; value: number; max: number; subtitle?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-neutral-700 dark:text-neutral-200 truncate">{label}</span>
        <span className="font-semibold text-neutral-900 dark:text-neutral-50">{formatMoney(value)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-blue-500 dark:bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      {subtitle && <p className="text-[10px] text-neutral-400">{subtitle}</p>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-neutral-950 dark:text-neutral-50">{title}</h2>
        {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="text-center py-10">
      <Icon className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
      <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{title}</p>
      <p className="text-xs text-neutral-400 mt-1">{body}</p>
    </div>
  );
}

export default async function SpendingPage() {
  let tasks: Task[] = [];
  let wishList: WishListItem[] = [];
  let errorState: { message?: string; code?: string } | null = null;
  let wishListError = false;

  const [taskResult, wishResult] = await Promise.allSettled([getTasks(), getWishListItems(false)]);

  if (taskResult.status === "fulfilled") {
    tasks = taskResult.value;
  } else {
    const e = taskResult.reason as { code?: string; message?: string };
    errorState = { message: e.message, code: e.code };
  }

  if (wishResult.status === "fulfilled") {
    wishList = wishResult.value;
  } else {
    wishListError = true;
  }

  if (errorState) {
    return (
      <div className="pt-6 pb-24">
        <div className="px-5 flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </Link>
            <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Spending</h1>
          </div>
          <PageMenu />
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
  const yearStart = startOfYear(now);
  const currentYear = now.getFullYear();
  const completedWithCosts = tasks.filter((t) => t.status === "Completed" && completedCost(t) > 0);
  const completedThisYear = completedWithCosts.filter((t) => {
    const completed = effectiveCompletedValue(t, now);
    return completed != null && completed >= yearStart.getTime();
  });
  const completedThisYearEstimateFallbacks = completedThisYear.filter(usesEstimateFallback).length;
  const completedThisYearUndated = completedThisYear.filter((t) => !t.dateCompleted).length;
  const openTasks = tasks.filter((t) => t.status !== "Completed");
  const openWithEstimates = openTasks.filter((t) => (t.costEstimate ?? 0) > 0);
  const activeWishList = wishList.filter((i) => i._status !== "Archived");

  const last30 = completedSpend(completedWithCosts, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30), now);
  const last90 = completedSpend(completedWithCosts, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90), now);
  const last12Start = addMonths(startOfMonth(now), -11);
  const last12 = completedSpend(completedWithCosts, last12Start, now);
  const ytdSpent = completedThisYear.reduce((sum, t) => sum + completedCost(t), 0);
  const ytdEstimated = completedThisYear.reduce((sum, t) => sum + (t.costEstimate ?? 0), 0);
  const estimateVariance = ytdEstimated > 0 ? ((ytdSpent - ytdEstimated) / ytdEstimated) * 100 : null;

  const dueInDays = (days: number) =>
    openWithEstimates.filter((t) => {
      const due = daysFromNow(t.dueDate, now);
      return due != null && due >= 0 && due <= days;
    });
  const dueNext30 = dueInDays(30);
  const dueNext90 = dueInDays(90);
  const dueNext365 = dueInDays(365);
  const overdueEstimated = openWithEstimates.filter((t) => {
    const due = daysFromNow(t.dueDate, now);
    return due != null && due < 0;
  });
  const noDateEstimated = openWithEstimates.filter((t) => !t.dueDate);

  const sumTaskEstimates = (rows: Task[]) => rows.reduce((sum, t) => sum + (t.costEstimate ?? 0), 0);
  const next30Estimate = sumTaskEstimates(dueNext30);
  const next90Estimate = sumTaskEstimates(dueNext90);
  const next12Committed = sumTaskEstimates(dueNext365) + sumTaskEstimates(overdueEstimated);

  const wishListCost = activeWishList.reduce((sum, item) => sum + (getActiveCost(item) ?? 0), 0);
  const wishListValue = activeWishList.reduce((sum, item) => sum + (item.valueAdd ?? 0), 0);
  const wishListRois = activeWishList.map(getActiveRoi).filter((roi): roi is number => roi != null);
  const avgWishListRoi = wishListRois.length > 0 ? wishListRois.reduce((sum, roi) => sum + roi, 0) / wishListRois.length : null;

  const timelineGroups = ["This Year", "Next Year", "2+ Years", "Someday", "Unscheduled"].map((timeline) => {
    const items = activeWishList.filter((item) => (item.timeline ?? "Unscheduled") === timeline);
    return {
      label: timeline,
      count: items.length,
      value: items.reduce((sum, item) => sum + (getActiveCost(item) ?? 0), 0),
      valueAdd: items.reduce((sum, item) => sum + (item.valueAdd ?? 0), 0),
    };
  }).filter((group) => group.count > 0 || group.value > 0);

  const thisYearWishlist = timelineGroups.find((group) => group.label === "This Year")?.value ?? 0;
  const nextYearWishlist = timelineGroups.find((group) => group.label === "Next Year")?.value ?? 0;
  const monthsElapsed = now.getMonth() + 1;
  const remainingMonths = Math.max(0, 12 - monthsElapsed);
  const ytdMonthlyRunRate = monthsElapsed > 0 ? ytdSpent / monthsElapsed : 0;
  const historicalMonthlyRunRate = last12 / 12;
  const monthlyRunRate = ytdMonthlyRunRate > 0 ? ytdMonthlyRunRate : historicalMonthlyRunRate;
  const yearEndProjection = ytdSpent + monthlyRunRate * remainingMonths;
  const expectedNext12 = historicalMonthlyRunRate * 12 + next12Committed + thisYearWishlist + nextYearWishlist;
  const reserveFloor = expectedNext12 > 0 ? expectedNext12 / 12 : historicalMonthlyRunRate;

  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const d = addMonths(startOfMonth(now), index - 11);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = completedWithCosts
      .filter((t) => {
        const completedDate = t.dateCompleted?.start ?? now.toISOString().slice(0, 7);
        return completedDate.startsWith(key);
      })
      .reduce((sum, t) => sum + completedCost(t), 0);
    return { key, label: d.toLocaleDateString("en-US", { month: "short" }), value: total };
  });
  const maxMonthly = Math.max(1, ...monthlyTotals.map((m) => m.value));

  const byArea = aggregateBy(completedThisYear.map((t) => ({ key: t.area, value: completedCost(t), estimate: t.costEstimate ?? 0 })));
  const byFutureArea = aggregateBy(openWithEstimates.map((t) => ({ key: t.area, value: t.costEstimate ?? 0 })));
  const byWishlistCategory = aggregateBy(activeWishList.map((item) => ({
    key: item.category,
    value: getActiveCost(item) ?? 0,
    estimate: item.valueAdd ?? 0,
  })));
  const maxSpentArea = Math.max(1, ...byArea.map((a) => a.value));
  const maxFutureArea = Math.max(1, ...byFutureArea.map((a) => a.value));
  const maxWishCategory = Math.max(1, ...byWishlistCategory.map((a) => a.value));

  const largestUpcoming = [...openWithEstimates]
    .sort((a, b) => (b.costEstimate ?? 0) - (a.costEstimate ?? 0))
    .slice(0, 5);
  const bestRoiProjects = [...activeWishList]
    .filter((item) => (getActiveCost(item) ?? 0) > 0 || (item.valueAdd ?? 0) > 0)
    .sort((a, b) => (getActiveRoi(b) ?? -1) - (getActiveRoi(a) ?? -1))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 pt-6 pb-24 animate-fade-in">
      <div className="px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Home Costs</h1>
            <p className="text-sm text-neutral-400">{currentYear} spending, commitments, and project runway</p>
          </div>
        </div>
        <PageMenu />
      </div>

      {wishListError && (
        <div className="mx-5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-700 dark:text-amber-300">
          Wish list costs are temporarily unavailable. Task spending is still shown.
        </div>
      )}

      <div className="mx-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyCard
          label="YTD Spent"
          value={formatMoney(ytdSpent)}
          detail={`${completedThisYear.length} completed item${completedThisYear.length !== 1 ? "s" : ""}${completedThisYearEstimateFallbacks > 0 ? ` · ${completedThisYearEstimateFallbacks} estimated` : ""}${completedThisYearUndated > 0 ? ` · ${completedThisYearUndated} undated` : ""}`}
          icon={WalletCards}
          tone="blue"
        />
        <MoneyCard label="Next 90 Days" value={formatMoney(next90Estimate)} detail={`${dueNext90.length} scheduled estimate${dueNext90.length !== 1 ? "s" : ""}`} icon={CalendarClock} tone={next90Estimate > 0 ? "amber" : "neutral"} />
        <MoneyCard label="Project Pipeline" value={formatMoney(wishListCost)} detail={`${activeWishList.length} active wishlist project${activeWishList.length !== 1 ? "s" : ""}`} icon={Heart} tone="emerald" />
        <MoneyCard label="Monthly Reserve" value={formatMoney(reserveFloor)} detail="Run-rate plus known future work" icon={PiggyBank} tone="neutral" />
      </div>

      <Section title="Spent" subtitle="Completed work using actual cost first. Undated completed costs count in the current period.">
        {completedWithCosts.length === 0 ? (
          <EmptyPanel icon={CheckCircle} title="No completed costs recorded yet" body="Completed tasks with actual costs or estimates will build the spending history." />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MoneyCard label="Last 30 Days" value={formatMoney(last30)} detail="Recent cash out" icon={DollarSign} tone="neutral" />
            <MoneyCard label="Last 90 Days" value={formatMoney(last90)} detail="Quarter view" icon={BarChart3} tone="neutral" />
            <MoneyCard label="Last 12 Months" value={formatMoney(last12)} detail="Annual run rate" icon={TrendingUp} tone="neutral" />
            <MoneyCard
              label="vs Estimate"
              value={estimateVariance == null ? "n/a" : `${Math.abs(Math.round(estimateVariance))}%`}
              detail={estimateVariance == null ? "Add estimates to compare" : estimateVariance >= 0 ? "Over estimate YTD" : "Under estimate YTD"}
              icon={estimateVariance != null && estimateVariance > 0 ? TrendingUp : TrendingDown}
              tone={estimateVariance == null ? "neutral" : estimateVariance > 10 ? "red" : estimateVariance < -10 ? "emerald" : "blue"}
            />
          </div>
        )}
      </Section>

      <Section title="Monthly Pattern" subtitle="Completed actual costs over the last 12 months">
        <div className="flex items-end justify-between gap-1 h-28">
          {monthlyTotals.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full bg-blue-500 dark:bg-blue-400 rounded-t"
                  style={{ height: `${(m.value / maxMonthly) * 100}%`, minHeight: m.value > 0 ? "2px" : "0" }}
                  title={`${m.label}: ${formatMoney(m.value)}`}
                />
              </div>
              <span className="text-[9px] text-neutral-400 font-medium">{m.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:mx-5 flex flex-col gap-6">
        <section className="mx-5 lg:mx-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-neutral-950 dark:text-neutral-50">Future Costs</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Open task estimates by timing</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MoneyCard label="Overdue" value={formatMoney(sumTaskEstimates(overdueEstimated))} detail={`${overdueEstimated.length} estimate${overdueEstimated.length !== 1 ? "s" : ""}`} icon={AlertTriangle} tone={overdueEstimated.length > 0 ? "red" : "neutral"} />
            <MoneyCard label="Next 30" value={formatMoney(next30Estimate)} detail={`${dueNext30.length} due soon`} icon={CalendarClock} tone="amber" />
            <MoneyCard label="Next 12 Mo." value={formatMoney(next12Committed)} detail={`${dueNext365.length + overdueEstimated.length} dated estimate${dueNext365.length + overdueEstimated.length !== 1 ? "s" : ""}`} icon={Target} tone="blue" />
            <MoneyCard label="Unscheduled" value={formatMoney(sumTaskEstimates(noDateEstimated))} detail={`${noDateEstimated.length} estimate${noDateEstimated.length !== 1 ? "s" : ""}`} icon={ClipboardList} tone="neutral" />
          </div>
          {largestUpcoming.length > 0 ? (
            <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
              {largestUpcoming.map((task) => (
                <Link key={task.id} href={`/task/${task.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-blue-600 transition-colors">
                  <span className="truncate text-neutral-700 dark:text-neutral-200">{task.task}</span>
                  <span className="font-semibold text-neutral-950 dark:text-neutral-50">{formatMoney(task.costEstimate ?? 0)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyPanel icon={ClipboardList} title="No future estimates yet" body="Open tasks with cost estimates will appear here." />
          )}
        </section>

        <section className="mx-5 lg:mx-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-neutral-950 dark:text-neutral-50">Wish List ROI</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Active dream projects by selected cost mode</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MoneyCard label="Total Cost" value={formatMoney(wishListCost)} detail={`${activeWishList.length} active project${activeWishList.length !== 1 ? "s" : ""}`} icon={Heart} tone="emerald" />
            <MoneyCard label="Value Add" value={formatMoney(wishListValue)} detail={`Average ROI ${formatPercent(avgWishListRoi)}`} icon={TrendingUp} tone="blue" />
          </div>
          {bestRoiProjects.length > 0 ? (
            <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
              {bestRoiProjects.map((item) => (
                <Link key={item.id} href="/wishlist" className="flex items-center justify-between gap-3 py-3 text-sm hover:text-blue-600 transition-colors">
                  <span className="truncate text-neutral-700 dark:text-neutral-200">{item.project}</span>
                  <span className="font-semibold text-neutral-950 dark:text-neutral-50">{formatPercent(getActiveRoi(item))}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyPanel icon={Heart} title="No ROI data yet" body="Wishlist items with costs and value add will rank here." />
          )}
        </section>
      </div>

      <Section title="Expected Costs" subtitle="A practical blend of history, scheduled work, and wishlist timing">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <MoneyCard label="Projected Year End" value={formatMoney(yearEndProjection)} detail="YTD spend plus current monthly run rate" icon={BarChart3} tone="blue" />
          <MoneyCard label="Known Next 12 Mo." value={formatMoney(next12Committed + thisYearWishlist + nextYearWishlist)} detail="Dated tasks plus near-term wishlist" icon={CalendarClock} tone="amber" />
          <MoneyCard label="Expected Next 12 Mo." value={formatMoney(expectedNext12)} detail="History plus known future work" icon={Shield} tone="neutral" />
        </div>
      </Section>

      {(byArea.length > 0 || byFutureArea.length > 0 || byWishlistCategory.length > 0) && (
        <div className="lg:grid lg:grid-cols-3 lg:gap-4 lg:mx-5 flex flex-col gap-6">
          {byArea.length > 0 && (
            <section className="mx-5 lg:mx-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <h2 className="text-base font-bold text-neutral-950 dark:text-neutral-50 mb-4">Spent by Area</h2>
              <div className="flex flex-col gap-3">
                {byArea.map((a) => (
                  <BarRow key={a.label} label={a.label} value={a.value} max={maxSpentArea} subtitle={`${a.count} completed item${a.count !== 1 ? "s" : ""}`} />
                ))}
              </div>
            </section>
          )}

          {byFutureArea.length > 0 && (
            <section className="mx-5 lg:mx-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <h2 className="text-base font-bold text-neutral-950 dark:text-neutral-50 mb-4">Future by Area</h2>
              <div className="flex flex-col gap-3">
                {byFutureArea.map((a) => (
                  <BarRow key={a.label} label={a.label} value={a.value} max={maxFutureArea} subtitle={`${a.count} open estimate${a.count !== 1 ? "s" : ""}`} />
                ))}
              </div>
            </section>
          )}

          {byWishlistCategory.length > 0 && (
            <section className="mx-5 lg:mx-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <h2 className="text-base font-bold text-neutral-950 dark:text-neutral-50 mb-4">Wishlist by Category</h2>
              <div className="flex flex-col gap-3">
                {byWishlistCategory.map((a) => (
                  <BarRow key={a.label} label={a.label} value={a.value} max={maxWishCategory} subtitle={`${a.count} project${a.count !== 1 ? "s" : ""} · value add ${formatMoney(a.estimate)}`} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {timelineGroups.length > 0 && (
        <Section title="Project Timing" subtitle="Wishlist pipeline by planned timing">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {timelineGroups.map((group) => (
              <div key={group.label} className="rounded-xl border border-neutral-100 dark:border-neutral-800 p-4">
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{group.label}</p>
                <p className="text-xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">{formatMoney(group.value)}</p>
                <p className="text-[11px] text-neutral-400 mt-1">{group.count} project{group.count !== 1 ? "s" : ""} · {formatMoney(group.valueAdd)} value</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Budget Lens" subtitle="A homeowner-friendly way to read the numbers">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950/40 p-4">
            <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Maintenance reserve</p>
            <p className="text-xs text-neutral-400 mt-1">Many homeowners budget around 1% to 4% of home value annually for maintenance and repairs.</p>
          </div>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950/40 p-4">
            <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Separate upgrades</p>
            <p className="text-xs text-neutral-400 mt-1">Wishlist ROI helps keep resale-minded projects separate from lifestyle improvements.</p>
          </div>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950/40 p-4">
            <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Watch timing</p>
            <p className="text-xs text-neutral-400 mt-1">The next 90 days and overdue estimates are the cash-pressure zones to review first.</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
