import type { ReactNode } from "react";

interface TaskSectionProps {
  title: string;
  count: number;
  accent?: "overdue";
  children: ReactNode;
}

export function TaskSection({ title, count, accent, children }: TaskSectionProps) {
  if (count === 0) return null;

  const isOverdue = accent === "overdue";

  return (
    <div className={isOverdue ? "border-l-2 border-red-500/60 pl-3" : ""}>
      <div className="flex items-center gap-2 mb-2">
        <h2 className={`text-sm font-semibold ${isOverdue ? "text-red-700 dark:text-red-400" : "text-neutral-600 dark:text-neutral-300"}`}>
          {title}
        </h2>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isOverdue ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"}`}>
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}
