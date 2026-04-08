"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  Priority,
  Status,
  Area,
  TaskType,
  Frequency,
} from "@/lib/types";
import {
  PRIORITIES,
  STATUSES,
  AREAS,
  TASK_TYPES,
  FREQUENCIES,
} from "@/lib/types";

interface TaskFormProps {
  task?: Task;
  mode: "create" | "edit";
}

export function TaskForm({ task, mode }: TaskFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(task?.task ?? "");
  const [status, setStatus] = useState<Status>(task?.status ?? "Not Started");
  const [priority, setPriority] = useState<Priority | "">(task?.priority ?? "");
  const [area, setArea] = useState<Area | "">(task?.area ?? "");
  const [subLocation, setSubLocation] = useState(task?.subLocation ?? "");
  const [types, setTypes] = useState<TaskType[]>(task?.type ?? []);
  const [frequency, setFrequency] = useState<Frequency | "">(task?.frequency ?? "");
  const [dueDateStart, setDueDateStart] = useState(task?.dueDate?.start ?? "");
  const [dueDateEnd, setDueDateEnd] = useState(task?.dueDate?.end ?? "");
  const [contractorVendor, setContractorVendor] = useState(task?.contractorVendor ?? "");
  const [costEstimate, setCostEstimate] = useState(task?.costEstimate?.toString() ?? "");
  const [actualCost, setActualCost] = useState(task?.actualCost?.toString() ?? "");

  function toggleType(t: TaskType) {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(secret ? { "x-app-secret": secret } : {}),
      };

      if (mode === "create") {
        const body: CreateTaskInput = {
          task: name.trim(),
          ...(status !== "Not Started" ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(area ? { area } : {}),
          ...(subLocation ? { subLocation } : {}),
          ...(types.length > 0 ? { type: types } : {}),
          ...(frequency ? { frequency } : {}),
          ...(dueDateStart ? { dueDate: { start: dueDateStart, ...(dueDateEnd ? { end: dueDateEnd } : {}) } } : {}),
          ...(contractorVendor ? { contractorVendor } : {}),
          ...(costEstimate ? { costEstimate: parseFloat(costEstimate) } : {}),
        };
        await fetch("/api/tasks", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      } else {
        const body: UpdateTaskInput = {
          task: name.trim(),
          status,
          priority: priority || undefined,
          area: area || undefined,
          subLocation: subLocation || undefined,
          type: types,
          frequency: frequency || undefined,
          dueDate: dueDateStart ? { start: dueDateStart, ...(dueDateEnd ? { end: dueDateEnd } : {}) } : null,
          contractorVendor: contractorVendor || undefined,
          costEstimate: costEstimate ? parseFloat(costEstimate) : undefined,
          actualCost: actualCost ? parseFloat(actualCost) : undefined,
        };
        await fetch(`/api/tasks/${task!.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body),
        });
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Failed to save task. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkComplete() {
    if (!task) return;
    setSaving(true);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({
          status: "Completed" as Status,
          dateCompleted: { start: new Date().toISOString().split("T")[0] },
        }),
      });
      router.push("/");
      router.refresh();
    } catch {
      setError("Failed to update task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm("Delete this task?")) return;
    setSaving(true);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
        headers: secret ? { "x-app-secret": secret } : {},
      });
      router.push("/");
      router.refresh();
    } catch {
      setError("Failed to delete task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-8">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Task name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Task name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Fix leaky kitchen faucet"
          required
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      {/* Status (edit only) */}
      {mode === "edit" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  status === s
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 active:bg-gray-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Priority
        </label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(priority === p ? "" : p)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                priority === p
                  ? p === "High"
                    ? "bg-red-100 text-red-700 border-red-300"
                    : p === "Medium"
                      ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                      : "bg-green-100 text-green-700 border-green-300"
                  : "bg-white text-gray-600 border-gray-200 active:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Area
        </label>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value as Area | "")}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Select area...</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Sub-location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sub-location
        </label>
        <input
          type="text"
          value={subLocation}
          onChange={(e) => setSubLocation(e.target.value)}
          placeholder="e.g., master bath, south fence"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Type (multi-select chips) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type
        </label>
        <div className="flex flex-wrap gap-2">
          {TASK_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                types.includes(t)
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 active:bg-gray-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Frequency
        </label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency | "")}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Select frequency...</option>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Due Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Due Date
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dueDateStart}
            onChange={(e) => setDueDateStart(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={dueDateEnd}
            onChange={(e) => setDueDateEnd(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">End date is optional (for date ranges)</p>
      </div>

      {/* Contractor/Vendor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contractor / Vendor
        </label>
        <input
          type="text"
          value={contractorVendor}
          onChange={(e) => setContractorVendor(e.target.value)}
          placeholder="e.g., Joe's Plumbing"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Cost Estimate */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cost Estimate ($)
        </label>
        <input
          type="number"
          value={costEstimate}
          onChange={(e) => setCostEstimate(e.target.value)}
          placeholder="0"
          min="0"
          step="0.01"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Actual Cost (edit only) */}
      {mode === "edit" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actual Cost ($)
          </label>
          <input
            type="number"
            value={actualCost}
            onChange={(e) => setActualCost(e.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3 rounded-xl bg-gray-900 text-white font-medium text-base disabled:opacity-50 active:bg-gray-700 transition-colors"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Task" : "Save Changes"}
        </button>

        {mode === "edit" && task?.status !== "Completed" && (
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-medium text-base disabled:opacity-50 active:bg-green-700 transition-colors"
          >
            Mark Complete
          </button>
        )}

        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-white text-red-600 font-medium text-base border border-red-200 disabled:opacity-50 active:bg-red-50 transition-colors"
          >
            Delete Task
          </button>
        )}
      </div>
    </form>
  );
}
