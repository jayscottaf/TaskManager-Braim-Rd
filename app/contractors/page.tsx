export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Wrench, Phone, Calendar, DollarSign, ChevronRight } from "lucide-react";
import { getTasks } from "@/lib/notion";
import { ErrorDetails } from "@/components/error-details";
import { PageMenu } from "@/components/page-menu";
import type { Task } from "@/lib/types";

interface Contractor {
  name: string;
  taskCount: number;
  totalSpend: number;
  lastUsed: string | null;
  specialties: Set<string>;
  tasks: Task[];
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return "this week";
  if (diffDays < 30) return `${Math.round(diffDays / 7)}wk ago`;
  if (diffDays < 365) return `${Math.round(diffDays / 30)}mo ago`;
  return `${Math.round(diffDays / 365)}y ago`;
}

function buildDirectory(tasks: Task[]): Contractor[] {
  const map = new Map<string, Contractor>();
  for (const t of tasks) {
    const name = t.contractorVendor?.trim();
    if (!name) continue;
    const entry = map.get(name) ?? {
      name,
      taskCount: 0,
      totalSpend: 0,
      lastUsed: null,
      specialties: new Set<string>(),
      tasks: [],
    };
    entry.taskCount += 1;
    entry.totalSpend += t.actualCost ?? 0;
    for (const tp of t.type) entry.specialties.add(tp);
    const completedDate = t.dateCompleted?.start ?? null;
    if (completedDate && (!entry.lastUsed || completedDate > entry.lastUsed)) {
      entry.lastUsed = completedDate;
    }
    entry.tasks.push(t);
    map.set(name, entry);
  }
  return Array.from(map.values()).sort((a, b) => {
    // Most recently used first, ties broken by spend
    if (a.lastUsed && b.lastUsed) return b.lastUsed.localeCompare(a.lastUsed);
    if (a.lastUsed) return -1;
    if (b.lastUsed) return 1;
    return b.totalSpend - a.totalSpend;
  });
}

export default async function ContractorsPage() {
  let tasks: Task[] = [];
  let errorState: { message?: string; code?: string } | null = null;

  try {
    tasks = await getTasks();
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
            <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Contractors</h1>
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

  const contractors = buildDirectory(tasks);

  return (
    <div className="flex flex-col gap-5 pt-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Contractors</h1>
            <p className="text-sm text-neutral-400">{contractors.length} vendor{contractors.length !== 1 ? "s" : ""} on file</p>
          </div>
        </div>
        <PageMenu />
      </div>

      {contractors.length === 0 ? (
        <div className="text-center py-16 mx-5">
          <Wrench className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">No contractors yet</p>
          <p className="text-sm text-neutral-400 mt-1">Add a contractor/vendor on a task to start building the directory.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          {contractors.map((c) => {
            const primarySpecialty = Array.from(c.specialties)[0];
            return (
              <div key={c.name} className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[16px] font-semibold text-neutral-950 dark:text-neutral-50 truncate">{c.name}</h3>
                    {primarySpecialty && (
                      <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        {Array.from(c.specialties).join(" · ")}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/add?contractor=${encodeURIComponent(c.name)}${primarySpecialty ? `&type=${encodeURIComponent(primarySpecialty)}` : ""}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 active:scale-[0.98] transition-all flex-shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" /> Book
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg py-2">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Tasks</p>
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{c.taskCount}</p>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg py-2">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Spent</p>
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{formatMoney(c.totalSpend)}</p>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg py-2">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Last</p>
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{formatRelativeDate(c.lastUsed)}</p>
                  </div>
                </div>
                <details className="group">
                  <summary className="text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 list-none flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                    View tasks
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {c.tasks
                      .sort((a, b) => (b.dateCompleted?.start ?? "").localeCompare(a.dateCompleted?.start ?? ""))
                      .map((t) => (
                        <Link
                          key={t.id}
                          href={`/task/${t.id}`}
                          className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-sm"
                        >
                          <span className="truncate flex-1 text-neutral-800 dark:text-neutral-200">{t.task}</span>
                          <span className="flex items-center gap-2 text-xs text-neutral-400 flex-shrink-0">
                            {t.dateCompleted?.start && (
                              <span className="inline-flex items-center gap-0.5">
                                <Calendar className="w-3 h-3" />
                                {t.dateCompleted.start}
                              </span>
                            )}
                            {t.actualCost != null && (
                              <span className="inline-flex items-center gap-0.5">
                                <DollarSign className="w-3 h-3" />
                                {Math.round(t.actualCost).toLocaleString()}
                              </span>
                            )}
                          </span>
                        </Link>
                      ))}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
