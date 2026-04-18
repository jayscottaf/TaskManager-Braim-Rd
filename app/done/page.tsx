export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, CheckCircle, Calendar, Trophy, Flame } from "lucide-react";
import { getTasks } from "@/lib/notion";
import { ErrorDetails } from "@/components/error-details";
import type { Task } from "@/lib/types";

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

interface MonthGroup {
  key: string;
  label: string;
  tasks: Task[];
  totalCost: number;
}

function groupByMonth(tasks: Task[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const t of tasks) {
    const date = t.dateCompleted?.start;
    if (!date) continue;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const group = map.get(key) ?? { key, label, tasks: [], totalCost: 0 };
    group.tasks.push(t);
    group.totalCost += t.actualCost ?? 0;
    map.set(key, group);
  }
  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function computeStreak(tasks: Task[]): number {
  const months = new Set<string>();
  for (const t of tasks) {
    if (!t.dateCompleted?.start) continue;
    const d = new Date(t.dateCompleted.start);
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const now = new Date();
  let streak = 0;
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (months.has(key)) streak++;
    else break;
  }
  return streak;
}

function extractPhotos(notes: string | null): string[] {
  if (!notes) return [];
  const section = notes.split("Photos:")[1];
  if (!section) return [];
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("http"));
}

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  Medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  Low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

export default async function DonePage() {
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
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Done</h1>
        </div>
        <div className="mx-5 p-5 bg-red-50 dark:bg-red-950/30 rounded-2xl">
          <p className="font-semibold text-red-700 dark:text-red-400">Having trouble connecting</p>
          <ErrorDetails message={errorState.message} code={errorState.code} />
        </div>
      </div>
    );
  }

  const months = groupByMonth(tasks);
  const streak = computeStreak(tasks);
  const totalCost = tasks.reduce((sum, t) => sum + (t.actualCost ?? 0), 0);

  const allPhotos: string[] = [];
  for (const t of tasks) {
    allPhotos.push(...extractPhotos(t.notes));
  }

  return (
    <div className="flex flex-col gap-6 pt-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="px-5 flex items-center gap-3">
        <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Done</h1>
          <p className="text-sm text-neutral-400">What you&apos;ve accomplished</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 mx-5">
          <CheckCircle className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">No completed tasks yet</p>
          <p className="text-sm text-neutral-400 mt-1">Mark tasks as complete to build your history.</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="mx-5 grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 text-center">
              <Trophy className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-neutral-950 dark:text-neutral-50">{tasks.length}</p>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Completed</p>
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 text-center">
              <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-neutral-950 dark:text-neutral-50">{streak}</p>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Month streak</p>
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 text-center">
              <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-neutral-950 dark:text-neutral-50">{formatMoney(totalCost)}</p>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Total spent</p>
            </div>
          </div>

          {/* Photo gallery */}
          {allPhotos.length > 0 && (
            <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm overflow-hidden">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium px-5 pt-4 pb-2">Photo Gallery</p>
              <div className="flex gap-1 overflow-x-auto snap-x snap-mandatory pb-3 px-1">
                {allPhotos.slice(0, 20).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Completed work ${i + 1}`} className="w-48 h-36 flex-shrink-0 snap-center object-cover rounded-lg" />
                ))}
              </div>
            </div>
          )}

          {/* Monthly groups */}
          {months.map((month) => (
            <div key={month.key} className="mx-5">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{month.label}</h2>
                <div className="flex items-center gap-3 text-xs text-neutral-400">
                  <span>{month.tasks.length} task{month.tasks.length > 1 ? "s" : ""}</span>
                  {month.totalCost > 0 && <span>{formatMoney(month.totalCost)}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {month.tasks
                  .sort((a, b) => (b.dateCompleted?.start ?? "").localeCompare(a.dateCompleted?.start ?? ""))
                  .map((t) => (
                    <Link
                      key={t.id}
                      href={`/task/${t.id}`}
                      className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-4 flex items-start justify-between gap-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">{t.task}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {t.area && <span className="text-xs text-neutral-500">{t.area}</span>}
                          {t.dateCompleted?.start && <span className="text-xs text-neutral-400">{t.dateCompleted.start}</span>}
                          {t.actualCost != null && <span className="text-xs text-neutral-400">{formatMoney(t.actualCost)}</span>}
                        </div>
                      </div>
                      {t.priority && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                          {t.priority}
                        </span>
                      )}
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
