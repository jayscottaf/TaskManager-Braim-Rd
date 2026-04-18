export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { getTasks } from "@/lib/notion";
import { ErrorDetails } from "@/components/error-details";
import { PageMenu } from "@/components/page-menu";
import { PrintButton } from "./print-button";
import type { Task, Status, Priority, Area } from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ status?: string; priority?: string; area?: string; range?: string }>;
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default async function ChecklistPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status as Status | undefined;
  const priority = params.priority as Priority | undefined;
  const area = params.area as Area | undefined;

  let tasks: Task[] = [];
  let errorState: { message?: string; code?: string } | null = null;

  try {
    tasks = await getTasks({
      status,
      priority,
      area,
      excludeCompleted: !status || status !== "Completed",
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    errorState = { message: e.message, code: e.code };
  }

  if (errorState) {
    return (
      <div className="pt-6 pb-24">
        <div className="px-5 flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </Link>
            <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Checklist</h1>
          </div>
          <PageMenu />
        </div>
        <div className="mx-5 p-5 bg-red-50 dark:bg-red-950/30 rounded-2xl">
          <p className="font-semibold text-red-700 dark:text-red-400">Having trouble connecting</p>
          <ErrorDetails message={errorState.message} code={errorState.code} />
        </div>
      </div>
    );
  }

  // Apply range filter client-side (same as homepage)
  const rangeDays = parseInt(params.range || "0", 10);
  if (rangeDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + rangeDays);
    tasks = tasks.filter((t) => {
      if (!t.dueDate) return true;
      return new Date(t.dueDate.start) <= cutoff;
    });
  }

  // Sort by priority then due date
  const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  tasks.sort((a, b) => {
    const aPri = PRIORITY_ORDER[a.priority || ""] ?? 3;
    const bPri = PRIORITY_ORDER[b.priority || ""] ?? 3;
    if (aPri !== bPri) return aPri - bPri;
    const aDate = a.dueDate?.start ?? "9999";
    const bDate = b.dueDate?.start ?? "9999";
    return aDate.localeCompare(bDate);
  });

  const totalEstimate = tasks.reduce((sum, t) => sum + (t.costEstimate ?? 0), 0);
  const activeFilters = [status, priority, area].filter(Boolean);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col gap-4 pt-6 pb-24 animate-fade-in">
      {/* Screen-only header */}
      <div className="px-5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Checklist</h1>
            <p className="text-sm text-neutral-400">{tasks.length} task{tasks.length !== 1 ? "s" : ""}{totalEstimate > 0 ? ` · ${formatMoney(totalEstimate)} est.` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <PageMenu />
        </div>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block px-5 mb-2">
        <h1 className="text-xl font-bold font-display">Braim Rd — Task Checklist</h1>
        <p className="text-sm text-neutral-500">{today}{activeFilters.length > 0 ? ` · Filtered: ${activeFilters.join(", ")}` : ""}</p>
        <p className="text-sm text-neutral-500">{tasks.length} task{tasks.length !== 1 ? "s" : ""}{totalEstimate > 0 ? ` · Total estimate: ${formatMoney(totalEstimate)}` : ""}</p>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 mx-5 print:hidden">
          <Printer className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">No tasks to print</p>
          <p className="text-sm text-neutral-400 mt-1">Adjust your filters on the homepage first.</p>
        </div>
      ) : (
        <div className="mx-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-300 dark:border-neutral-700 text-left">
                <th className="py-2 w-8 print:w-6"></th>
                <th className="py-2 font-semibold text-neutral-700 dark:text-neutral-300">Task</th>
                <th className="py-2 font-semibold text-neutral-700 dark:text-neutral-300 hidden sm:table-cell print:table-cell">Area</th>
                <th className="py-2 font-semibold text-neutral-700 dark:text-neutral-300">Priority</th>
                <th className="py-2 font-semibold text-neutral-700 dark:text-neutral-300 text-right">Est. Cost</th>
                <th className="py-2 font-semibold text-neutral-700 dark:text-neutral-300 hidden sm:table-cell print:table-cell">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-2.5 pr-2">
                    <div className="w-5 h-5 rounded border-2 border-neutral-300 dark:border-neutral-600 print:border-neutral-400" />
                  </td>
                  <td className="py-2.5 text-neutral-900 dark:text-neutral-50 font-medium">{t.task}</td>
                  <td className="py-2.5 text-neutral-500 hidden sm:table-cell print:table-cell">{t.area || "—"}</td>
                  <td className="py-2.5">
                    {t.priority ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        t.priority === "High" ? "bg-red-100 text-red-700 print:bg-transparent print:text-red-700 print:border print:border-red-300"
                        : t.priority === "Medium" ? "bg-amber-100 text-amber-700 print:bg-transparent print:text-amber-700 print:border print:border-amber-300"
                        : "bg-emerald-100 text-emerald-700 print:bg-transparent print:text-emerald-700 print:border print:border-emerald-300"
                      }`}>
                        {t.priority}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 text-right text-neutral-700 dark:text-neutral-300 tabular-nums">
                    {t.costEstimate != null ? formatMoney(t.costEstimate) : "—"}
                  </td>
                  <td className="py-2.5 text-neutral-500 hidden sm:table-cell print:table-cell">
                    {t.dueDate?.start ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 dark:border-neutral-700">
                <td colSpan={4} className="py-2 text-right font-semibold text-neutral-700 dark:text-neutral-300">Total</td>
                <td className="py-2 text-right font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">{formatMoney(totalEstimate)}</td>
                <td className="hidden sm:table-cell print:table-cell"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
