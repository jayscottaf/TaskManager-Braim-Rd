export const dynamic = "force-dynamic";

import { getTasks } from "@/lib/notion";
import { CalendarView } from "@/components/calendar-view";

export default async function CalendarPage() {
  const tasks = await getTasks();

  return (
    <div className="flex flex-col gap-6 pt-6 pb-4">
      <div className="px-5">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Calendar</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Tasks by due date</p>
      </div>
      <CalendarView tasks={tasks} />
    </div>
  );
}
