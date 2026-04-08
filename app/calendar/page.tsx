export const dynamic = "force-dynamic";

import { getTasks } from "@/lib/notion";
import { CalendarView } from "@/components/calendar-view";

export default async function CalendarPage() {
  const tasks = await getTasks();

  return (
    <div className="flex flex-col gap-4 pt-2 pb-4">
      <div className="px-4 pt-2">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tasks by due date</p>
      </div>
      <CalendarView tasks={tasks} />
    </div>
  );
}
