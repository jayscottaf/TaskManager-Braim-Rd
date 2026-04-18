"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { showToast } from "@/components/toast";
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

function extractPhotoUrls(text: string | null): string[] {
  if (!text) return [];
  const urls: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("http") && (trimmed.includes("blob.vercel-storage") || trimmed.includes("/paint-labels/"))) {
      urls.push(trimmed);
    }
  }
  return urls;
}

interface TaskFormProps {
  task?: Task;
  mode: "create" | "edit";
  photoUrls?: string[];
}

export function TaskForm({ task, mode, photoUrls: initialPhotoUrls }: TaskFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCompletePhoto, setShowCompletePhoto] = useState(false);
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [taskPhotos, setTaskPhotos] = useState<string[]>(
    initialPhotoUrls ?? extractPhotoUrls(task?.notes ?? null)
  );
  const [addingPhoto, setAddingPhoto] = useState(false);

  async function addTaskPhoto(file: File) {
    setAddingPhoto(true);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: secret ? { "x-app-secret": secret } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setTaskPhotos((prev) => [...prev, data.url]);
    } catch {
      setError("Photo upload failed.");
    } finally {
      setAddingPhoto(false);
    }
  }

  function buildNotesWithPhotos(): string {
    const baseNotes = notes.split("\n\nPhotos:")[0].split("\nAfter photo:")[0].trim();
    if (taskPhotos.length === 0) return baseNotes;
    return `${baseNotes}\n\nPhotos:\n${taskPhotos.join("\n")}`.trim();
  }

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
          ...(() => { const n = buildNotesWithPhotos(); return n ? { notes: n } : {}; })(),
          ...(tags.length > 0 ? { tags } : {}),
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
          notes: buildNotesWithPhotos() || undefined,
          tags,
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

  async function uploadAfterPhoto(file: File): Promise<void> {
    setUploadingPhoto(true);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: secret ? { "x-app-secret": secret } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setAfterPhotoUrl(data.url);
    } catch {
      setError("Photo upload failed.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleMarkComplete(photoUrl?: string | null) {
    if (!task) return;
    setSaving(true);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const updatedNotes = photoUrl
        ? `${notes || ""}\n\nAfter photo: ${photoUrl}`.trim()
        : undefined;
      const body: Record<string, unknown> = {
        status: "Completed" as Status,
        dateCompleted: { start: new Date().toISOString().split("T")[0] },
      };
      if (updatedNotes) body.notes = updatedNotes;
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.nextOccurrence) {
        const next = data.nextOccurrence;
        showToast(`Next occurrence scheduled for ${next.dueDate?.start ?? "soon"}`, "info");
      } else {
        showToast("Task completed!", "success");
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Failed to update task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-5 pb-8 animate-fade-in">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Task name */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
          Task name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Fix leaky kitchen faucet"
          required
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-shadow"
        />
      </div>

      {/* Status (edit only) */}
      {mode === "edit" && (
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  status === s
                    ? "bg-white dark:bg-neutral-700 text-neutral-950 dark:text-neutral-50 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
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
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
          Priority
        </label>
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(priority === p ? "" : p)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                priority === p
                  ? p === "High"
                    ? "bg-red-50 text-red-700 shadow-sm"
                    : p === "Medium"
                      ? "bg-amber-50 text-amber-700 shadow-sm"
                      : "bg-emerald-50 text-emerald-700 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Area + Sub-location side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
            Area
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as Area | "")}
            className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
          >
            <option value="">Select area...</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
            Sub-location
          </label>
          <input
            type="text"
            value={subLocation}
            onChange={(e) => setSubLocation(e.target.value)}
            placeholder="e.g., master bath"
            className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
          />
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
          Type
        </label>
        <select
          value={types[0] || ""}
          onChange={(e) => {
            const val = e.target.value as TaskType | "";
            setTypes(val ? [val] : []);
          }}
          className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
        >
          <option value="">Select type...</option>
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
          Tags
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium"
            >
              {tag}
              <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const val = tagInput.trim().replace(/,/g, "");
                if (val && !tags.includes(val)) setTags((prev) => [...prev, val]);
                setTagInput("");
              }
            }}
            placeholder="Type and press Enter..."
            className="flex-1 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
          />
          <button
            type="button"
            onClick={() => {
              const val = tagInput.trim().replace(/,/g, "");
              if (val && !tags.includes(val)) setTags((prev) => [...prev, val]);
              setTagInput("");
            }}
            disabled={!tagInput.trim()}
            className="px-3 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-30 hover:bg-blue-700 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
          Frequency
        </label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency | "")}
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-base bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
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
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
          Due Date
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dueDateStart}
            onChange={(e) => setDueDateStart(e.target.value)}
            onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
            readOnly={false}
            className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow cursor-pointer"
          />
          <span className="text-neutral-300 text-sm">to</span>
          <input
            type="date"
            value={dueDateEnd}
            onChange={(e) => setDueDateEnd(e.target.value)}
            onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
            readOnly={false}
            className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow cursor-pointer"
          />
        </div>
        <p className="text-xs text-neutral-400 mt-1.5">End date is optional (for date ranges)</p>
      </div>

      {/* Contractor + Cost side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
            Contractor / Vendor
          </label>
          <input
            type="text"
            value={contractorVendor}
            onChange={(e) => setContractorVendor(e.target.value)}
            placeholder="e.g., Joe's Plumbing"
            className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
            Cost Estimate ($)
          </label>
          <input
            type="number"
            value={costEstimate}
            onChange={(e) => setCostEstimate(e.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
            className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
          />
        </div>
      </div>

      {/* Actual Cost (edit only) */}
      {mode === "edit" && (
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
            Actual Cost ($)
          </label>
          <input
            type="number"
            value={actualCost}
            onChange={(e) => setActualCost(e.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes, observations, or reminders..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow resize-y"
        />
      </div>

      {/* Photos */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">
          Photos
        </label>
        <div className="flex gap-2 flex-wrap">
          {taskPhotos.map((url, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => setTaskPhotos((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className={`w-20 h-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors ${addingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
            {addingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            <span className="text-[9px] font-medium mt-0.5">{addingPhoto ? "..." : "Add"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addTaskPhoto(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2.5 pt-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-base disabled:opacity-50 hover:bg-blue-700 active:scale-[0.99] transition-all"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Task" : "Save Changes"}
        </button>

        {mode === "edit" && task?.status !== "Completed" && !showCompletePhoto && (
          <button
            type="button"
            onClick={() => setShowCompletePhoto(true)}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-base disabled:opacity-50 hover:bg-emerald-700 active:scale-[0.99] transition-all"
          >
            Mark Complete
          </button>
        )}

        {showCompletePhoto && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-900 flex flex-col gap-3">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Add an &quot;after&quot; photo? (optional)</p>
            {afterPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={afterPhotoUrl} alt="After photo" className="w-full max-h-48 object-contain rounded-lg" />
            ) : (
              <label className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 cursor-pointer text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors ${uploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                {uploadingPhoto ? "Uploading..." : "Tap to take or select photo"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAfterPhoto(file);
                  }}
                />
              </label>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowCompletePhoto(false); setAfterPhotoUrl(null); }}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMarkComplete(afterPhotoUrl)}
                disabled={saving || uploadingPhoto}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {saving ? "Completing..." : afterPhotoUrl ? "Complete with photo" : "Complete without photo"}
              </button>
            </div>
          </div>
        )}

        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className={`w-full py-3 rounded-xl font-medium text-base disabled:opacity-50 transition-all ${
              confirmDelete
                ? "bg-red-600 text-white hover:bg-red-700"
                : "text-red-500 hover:bg-red-50 active:bg-red-100"
            }`}
          >
            {confirmDelete ? "Tap again to delete" : "Delete Task"}
          </button>
        )}
      </div>
    </form>
  );
}
