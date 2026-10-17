export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, ChevronDown, WalletCards } from "lucide-react";
import { getTasks } from "@/lib/notion";
import { getActiveCost, getWishListItems } from "@/lib/wishlist";
import { recordedCost, summarizeSpending } from "@/lib/costs";
import { householdCalendarNow } from "@/lib/household-date";
import { ErrorDetails } from "@/components/error-details";
import { PageMenu } from "@/components/page-menu";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const panel = "mx-5 rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-900";
const muted = "text-sm text-neutral-600 dark:text-neutral-400";

function DetailSummary({ title, detail }: { title: string; detail: string }) {
  return <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
    <span><span className="block font-semibold text-neutral-950 dark:text-neutral-50">{title}</span><span className={`mt-1 block ${muted}`}>{detail}</span></span>
    <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-500 transition-transform group-open:rotate-180" />
  </summary>;
}

export default async function SpendingPage() {
  const [tasksResult, ideasResult] = await Promise.allSettled([getTasks(), getWishListItems(false)]);
  if (tasksResult.status === "rejected") {
    const error = tasksResult.reason as { message?: string; code?: string };
    return <div className="pt-6 pb-28"><h1 className="mx-5 mb-5 text-2xl font-bold">Home costs</h1><div className={panel}><p className="font-semibold">Spending is temporarily unavailable</p><p className={muted}>Refresh to try again. Your saved tasks are unchanged.</p><ErrorDetails message={error.message} code={error.code} /></div></div>;
  }
  const tasks = tasksResult.value;
  const spending = summarizeSpending(tasks);
  const ideas = ideasResult.status === "fulfilled" ? ideasResult.value.filter((item) => item._status !== "Archived" && !item.promotedTaskId) : [];
  const planned = tasks.filter((task) => task.status !== "Completed" && (task.costEstimate ?? 0) > 0);
  const plannedTotal = planned.reduce((total, task) => total + (task.costEstimate ?? 0), 0);
  const ideasTotal = ideas.reduce((total, item) => total + (getActiveCost(item) ?? 0), 0);
  const maxMonthly = Math.max(1, ...spending.months.map((month) => month.value));
  const currentYear = householdCalendarNow().getFullYear();

  return <div className="flex flex-col gap-5 pt-6 pb-28 animate-fade-in">
    <header className="flex items-center justify-between gap-3 px-5">
      <div className="flex items-center gap-3"><Link href="/" aria-label="Back to your plan" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="font-display text-2xl font-bold tracking-tight">Home costs</h1><p className={muted}>What you paid, with room to plan ahead.</p></div></div><PageMenu />
    </header>

    <section className={panel} aria-labelledby="recorded-spending-heading">
      <div className="flex items-center gap-2"><WalletCards aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-300" /><h2 id="recorded-spending-heading" className="text-sm font-semibold">Recorded spending</h2></div>
      <p className="mt-3 text-4xl font-semibold tracking-tight">{money(spending.total)}</p>
      <p className={`mt-2 ${muted}`}>{spending.expenses.length === 0 ? "Add an actual cost when you complete a task." : `${spending.expenses.length} recorded expense${spending.expenses.length === 1 ? "" : "s"} across all dates.`}</p>
      <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-700"><span className={muted}>{currentYear} dated spending</span><span className="text-lg font-semibold">{money(spending.yearTotal)}</span></div>
    </section>

    {spending.undated.length > 0 && <section className={panel} aria-labelledby="undated-heading">
      <h2 id="undated-heading" className="font-semibold">Add dates to {money(spending.undatedTotal)} in expenses</h2>
      <p className={`mt-1 ${muted}`}>These are included in recorded spending. Add completion dates to include them in monthly and yearly totals.</p>
      <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-700">{spending.undated.map((task) => <Link key={task.id} href={`/task/${task.id}`} className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0">{task.task}<span className="mt-1 block text-blue-700 dark:text-blue-300">Add completion date</span></span><span className="shrink-0 font-semibold">{money(recordedCost(task))}</span></Link>)}</div>
    </section>}

    <details className={`group ${panel}`}>
      <DetailSummary title="Spending history" detail="Recorded actual costs by month and completed task" />
      <div className="mt-5">
        {spending.months.some((month) => month.value > 0) ? <><h3 className="mb-3 text-sm font-medium">Last 12 months</h3><div role="img" aria-label={`Monthly recorded spending: ${spending.months.map((month) => `${month.label} ${money(month.value)}`).join(", ")}`} className="flex h-32 items-end gap-2">{spending.months.map((month) => <div key={month.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="flex w-full flex-1 items-end"><div className="w-full rounded-t bg-blue-500 dark:bg-blue-300" style={{ height: `${month.value / maxMonthly * 100}%`, minHeight: month.value > 0 ? 3 : 0 }} /></div><span className="text-[10px] text-neutral-600 dark:text-neutral-400">{month.label}</span></div>)}</div></> : <p className={muted}>No dated expenses in the last 12 months. Your chart will appear as you record costs and completion dates.</p>}
        {spending.expenses.length > 0 && <div className="mt-5 divide-y divide-neutral-200 dark:divide-neutral-700">{spending.expenses.map((task) => <Link key={task.id} href={`/task/${task.id}`} className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm"><span>{task.task}<span className={`mt-1 block text-xs ${muted}`}>{task.dateCompleted?.start ?? "Completion date needed"}</span></span><span className="shrink-0 font-semibold">{money(recordedCost(task))}</span></Link>)}</div>}
        {spending.completedWithoutActualCost.length > 0 && <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-700"><h3 className="text-sm font-semibold">Completed work with no actual cost recorded</h3><p className={`mt-1 ${muted}`}>Estimates stay separate from spending. Record the amount you paid, including $0 for work that cost nothing.</p>{spending.completedWithoutActualCost.map((task) => <Link key={task.id} href={`/task/${task.id}`} className="block py-3 text-sm text-blue-700 dark:text-blue-300">{task.task} — add actual cost</Link>)}</div>}
      </div>
    </details>

    <details className={`group ${panel}`}>
      <DetailSummary title="Planned task estimates" detail="Explore costs when you are ready to plan" />
      <div className="mt-4"><p className="text-2xl font-semibold">{money(plannedTotal)}</p><p className={`mt-1 ${muted}`}>{planned.length} open task estimate{planned.length === 1 ? "" : "s"}. Planning amounts only; dates do not commit you to spending.</p>
        {planned.length === 0 ? <p className={`mt-4 ${muted}`}>No open task estimates.</p> : <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-700">{[...planned].sort((a, b) => (b.costEstimate ?? 0) - (a.costEstimate ?? 0)).map((task) => <Link key={task.id} href={`/task/${task.id}`} className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm"><span>{task.task}<span className={`mt-1 block text-xs ${muted}`}>{task.dueDate ? `Planned for ${task.dueDate.start}` : "No date planned"}</span></span><span className="shrink-0 font-medium">{money(task.costEstimate ?? 0)}</span></Link>)}</div>}
      </div>
    </details>

    <details className={`group ${panel}`}>
      <DetailSummary title="Compare wishlist ideas" detail="Optional projects, separate from your task estimates and spending" />
      <div className="mt-4">{ideasResult.status === "rejected" ? <p className={muted}>Wishlist ideas are temporarily unavailable. Refresh to try again.</p> : <><p className="text-2xl font-semibold">{money(ideasTotal)}</p><p className={`mt-1 ${muted}`}>The combined estimate for {ideas.length} optional idea{ideas.length === 1 ? "" : "s"}, using your selected DIY or hired cost. This is not a budget or a spending forecast.</p><div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-700">{ideas.map((item) => <div key={item.id} className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm"><span>{item.project}</span><span className="shrink-0 font-medium">{getActiveCost(item) == null ? "No estimate" : money(getActiveCost(item)!)}</span></div>)}</div><Link href="/wishlist" className="mt-3 inline-flex min-h-11 items-center font-medium text-blue-700 dark:text-blue-300">Review wishlist ideas →</Link></>}
      </div>
    </details>
  </div>;
}
