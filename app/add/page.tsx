import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageMenu } from "@/components/page-menu";
import { TaskForm } from "@/components/task-form";
import { safeReturnTo } from "@/lib/client-request";
import { calendarDay } from "@/lib/calendar-state";
import { AREAS, PRIORITIES, TASK_TYPES, FREQUENCIES, type Task } from "@/lib/types";

type Params = Record<string, string | string[] | undefined>;

/** Render capture immediately; URL prefill does not need a client loading screen. */
export default async function AddTaskPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const get = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  const returnTo = safeReturnTo(get("returnTo"));
  const prefill: Partial<Task> = {};
  const name = get("task");
  if (name) prefill.task = name;
  const area = get("area");
  if (area && AREAS.includes(area as Task["area"] & string)) prefill.area = area as Task["area"];
  const priority = get("priority");
  if (priority && PRIORITIES.includes(priority as Task["priority"] & string)) prefill.priority = priority as Task["priority"];
  const types = (get("types") || get("type") || "").split(",");
  prefill.type = TASK_TYPES.filter((type) => types.includes(type));
  const frequency = get("frequency");
  if (frequency && FREQUENCIES.includes(frequency as Task["frequency"] & string)) prefill.frequency = frequency as Task["frequency"];
  const date = get("dueDate");
  if (calendarDay(date)) prefill.dueDate = { start: date! };
  const contractor = get("contractor");
  if (contractor) prefill.contractorVendor = contractor;
  return <div className="flex flex-col gap-6 pb-4 pt-6 animate-fade-in">
    <header className="flex items-center justify-between px-5">
      <div className="flex items-center gap-3"><Link href={returnTo || "/"} aria-label="Back to previous screen" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800"><ArrowLeft className="h-5 w-5" /></Link><h1 className="font-display text-2xl font-bold tracking-tight">Add task</h1></div>
      <PageMenu />
    </header>
    <TaskForm mode="create" task={prefill} returnTo={returnTo} />
  </div>;
}
