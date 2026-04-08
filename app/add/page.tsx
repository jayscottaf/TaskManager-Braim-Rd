import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TaskForm } from "@/components/task-form";

export default function AddTaskPage() {
  return (
    <div className="flex flex-col gap-4 pt-2 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-2">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Add Task</h1>
      </div>

      <TaskForm mode="create" />
    </div>
  );
}
