export const dynamic = "force-dynamic";

import { getTasks } from "@/lib/notion";
import { CalendarView } from "@/components/calendar-view";
import { ErrorDetails } from "@/components/error-details";

export default async function CalendarPage() {
  let tasks;
  try {
    tasks = await getTasks();
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    return (
      <div className="flex flex-col gap-6 pt-6 pb-4">
        <div className="px-5">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Calendar</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Tasks by due date</p>
        </div>
        <div className="mx-5 p-5 bg-red-50 dark:bg-red-950/30 rounded-2xl">
          <p className="font-semibold text-red-700 dark:text-red-400">Having trouble connecting</p>
          <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">Try refreshing in a moment.</p>
          <ErrorDetails message={e.message} code={e.code} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-6 pb-4">
      <div className="px-5">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Calendar</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Tasks by due date</p>
      </div>
      <CalendarView tasks={tasks} />
    </div>
  );
}
