"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { showToast } from "@/components/toast";
import { openLightbox } from "@/components/lightbox";
import { TaskImage } from "@/components/task-image";
import { RequestError, requestJson, safeReturnTo, taskRequestHeaders } from "@/lib/client-request";
import { initialTaskDraft, draftUpdate, mergePhotoSuggestions, recoverPendingCompletion, validateTaskDraft, type TaskDraft } from "@/lib/task-form-data";
import { parseTaskNotes } from "@/lib/task-notes";
import { householdDateKey } from "@/lib/household-date";
import { completionNotice } from "@/lib/completion-notice";
import { analyzeUploadedImage, uploadImage } from "@/lib/image-client";
import type { PhotoClassification, TaskAnalysis } from "@/lib/ai";
import type { Task, CreateTaskInput, Priority, Area, Frequency, Status } from "@/lib/types";
import { PRIORITIES, STATUSES, AREAS, TASK_TYPES, FREQUENCIES } from "@/lib/types";

export interface TaskAIUpdate {
  revision: number;
  costEstimate?: number;
  workMode?: "DIY" | "Contractor";
  analysis?: TaskAnalysis;
}

interface TaskFormProps {
  task?: Partial<Task>;
  mode: "create" | "edit";
  returnTo?: string | null;
  aiUpdate?: TaskAIUpdate;
  children?: ReactNode;
}

const inputClass = "w-full min-h-12 px-3.5 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent";
const labelClass = "block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2";
const secondaryButton = "min-h-11 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50";

export function TaskForm({ task, mode, returnTo, aiUpdate, children }: TaskFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialTaskDraft(task));
  const [saving, setSaving] = useState(false);
  const [recurrencePending, setRecurrencePending] = useState(task?.nextOccurrencePending ?? false);
  const [error, setError] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [analysisRetry, setAnalysisRetry] = useState<{ url: string; context: string } | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCompletePhoto, setShowCompletePhoto] = useState(false);
  const [serverEarlyCompletionDate, setServerEarlyCompletionDate] = useState<string | null>(null);
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [completionPhotos] = useState(() => parseTaskNotes(task?.notes).afterPhotos);
  const attachments = useRef(parseTaskNotes(task?.notes));
  const touched = useRef(new Set<keyof TaskDraft>());
  const pendingUploads = useRef(0);
  const mutationInFlight = useRef(false);
  const appliedAIRevision = useRef<number | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionReview = useRef<HTMLElement | null>(null);
  const busy = saving || uploadCount > 0;
  const futureRepeatDate = task?.status !== "Completed" && draft.frequency && draft.frequency !== "One-time" && draft.date.slice(0, 10) > localToday()
    ? draft.date.slice(0, 10) : null;
  const earlyCompletionDate = serverEarlyCompletionDate ?? futureRepeatDate;

  useEffect(() => () => { if (deleteTimer.current) clearTimeout(deleteTimer.current); }, []);
  useEffect(() => {
    if (showCompletePhoto) completionReview.current?.focus();
  }, [showCompletePhoto]);

  useEffect(() => {
    if (!aiUpdate || appliedAIRevision.current === aiUpdate.revision) return;
    appliedAIRevision.current = aiUpdate.revision;
    if (aiUpdate.analysis) attachments.current.analysis = JSON.stringify(aiUpdate.analysis);
    // These fields arrive only after the user explicitly chooses Apply in the analysis panel.
    if (aiUpdate.costEstimate !== undefined || aiUpdate.workMode !== undefined) {
      if (aiUpdate.costEstimate !== undefined) touched.current.add("estimate");
      if (aiUpdate.workMode !== undefined) touched.current.add("workMode");
      setDraft((previous) => ({
        ...previous,
        ...(aiUpdate.costEstimate !== undefined ? { estimate: String(aiUpdate.costEstimate) } : {}),
        ...(aiUpdate.workMode !== undefined ? { workMode: aiUpdate.workMode } : {}),
      }));
    }
  }, [aiUpdate]);

  function update<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    touched.current.add(key);
    if (key === "date" || key === "frequency") setServerEarlyCompletionDate(null);
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function finishNavigation() {
    const destination = safeReturnTo(returnTo);
    if (destination) router.push(destination);
    else if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push("/");
    router.refresh();
  }

  async function addPhoto(file: File, after = false) {
    pendingUploads.current += 1;
    setUploadCount(pendingUploads.current);
    setError(null);
    setPhotoMessage(null);
    try {
      const context = draft.notes.trim() || draft.name.trim();
      const result = await uploadImage(file, mode === "create" && !after ? { analysis: "task", context } : undefined);
      if (after) setAfterPhotoUrl(result.url);
      else {
        setDraft((previous) => {
          const withPhoto = { ...previous, photos: [...new Set([...previous.photos, result.url])] };
          return result.classification && typeof result.classification === "object" && "task" in result.classification
            ? mergePhotoSuggestions(withPhoto, result.classification as PhotoClassification, touched.current)
            : withPhoto;
        });
      }
      if (result.analysisError) {
        setAnalysisRetry({ url: result.url, context });
        setPhotoMessage("Photo attached. Suggestions weren’t available; you can still save your task.");
      }
      else if (result.classification) setPhotoMessage("Photo attached. Suggestions filled empty details; your entries were kept.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo upload failed. Please select the photo to try again.");
    } finally {
      pendingUploads.current -= 1;
      setUploadCount(pendingUploads.current);
    }
  }

  async function retryPhotoAnalysis() {
    if (!analysisRetry || mutationInFlight.current || pendingUploads.current) return;
    pendingUploads.current += 1;
    setUploadCount(pendingUploads.current);
    setError(null);
    try {
      const result = await analyzeUploadedImage(analysisRetry.url, "task", analysisRetry.context);
      if (!result || typeof result !== "object" || !("task" in result)) throw new Error("Suggestions weren’t available. Your attached photo is safe.");
      setDraft((previous) => mergePhotoSuggestions(previous, result as PhotoClassification, touched.current));
      setAnalysisRetry(null);
      setPhotoMessage("Suggestions filled empty details; your entries were kept.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Suggestions weren’t available. You can still save your task.");
    } finally {
      pendingUploads.current -= 1;
      setUploadCount(pendingUploads.current);
    }
  }

  async function saveTask(complete = false, confirmEarlyCompletion = false) {
    if (mutationInFlight.current) return;
    if (pendingUploads.current) {
      setError("Wait for your photos to finish uploading, then save.");
      return;
    }
    const validation = validateTaskDraft(draft);
    if (validation) { setError(validation); return; }
    const status = complete || recurrencePending ? "Completed" : draft.status;
    if (mode === "edit" && status === "Completed" && !recurrencePending && earlyCompletionDate && !confirmEarlyCompletion) {
      setShowCompletePhoto(true);
      setError(null);
      return;
    }
    mutationInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const body = draftUpdate(draft, attachments.current, status, status === "Completed" ? afterPhotoUrl : null);
      if (mode === "edit") {
        if (!task?.id) throw new Error("This task could not be identified. Please reopen it and try again.");
        if (status === "Completed" && task.status !== "Completed" && !draft.completedDate) body.dateCompleted = { start: localToday() };
        const data = await requestJson<{ nextOccurrence?: Task }>(`/api/tasks/${task.id}`, {
          method: "PATCH", headers: taskRequestHeaders(), body: JSON.stringify({ ...body, ...(confirmEarlyCompletion ? { confirmEarlyCompletion: true } : {}) }),
        });
        if (status === "Completed" && (task.status !== "Completed" || recurrencePending)) {
          showToast(completionNotice(data?.nextOccurrence), "success");
        } else showToast("Changes saved", "success");
      } else {
        // Null explicitly clears fields on edit; new tasks simply omit unused optional values.
        const create = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== null)) as CreateTaskInput;
        await requestJson("/api/tasks", { method: "POST", headers: taskRequestHeaders(), body: JSON.stringify(create) });
        showToast("Task saved", "success");
      }
      finishNavigation();
    } catch (cause) {
      if (cause instanceof RequestError && task?.id) {
        if (cause.status === 409 && cause.body && typeof cause.body === "object" && "code" in cause.body && cause.body.code === "EARLY_RECURRENCE_COMPLETION") {
          const plannedFor = "plannedFor" in cause.body ? cause.body.plannedFor : null;
          if (typeof plannedFor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(plannedFor)) {
            setServerEarlyCompletionDate(plannedFor);
            setShowCompletePhoto(true);
            setError(null);
            return;
          }
        }
        const recovered = recoverPendingCompletion(draft, cause.body, task.id);
        if (recovered) {
          setDraft((previous) => recoverPendingCompletion(previous, cause.body, task.id!) ?? previous);
          setRecurrencePending(true);
          setShowCompletePhoto(false);
        }
      }
      setError(cause instanceof Error ? cause.message : "Couldn’t save your task. Your entries are still here; please try again.");
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (showCompletePhoto && !recurrencePending) {
      completionReview.current?.focus();
      return;
    }
    void saveTask();
  }

  function cancelCompletion() {
    setShowCompletePhoto(false);
    setServerEarlyCompletionDate(null);
    // Selecting Completed in More details is also only a pending completion until saved.
    if (draft.status === "Completed" && task?.status !== "Completed") update("status", task?.status ?? "Not Started");
  }

  async function handleDelete() {
    if (!task?.id || mutationInFlight.current || pendingUploads.current) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      deleteTimer.current = setTimeout(() => setConfirmDelete(false), 5000);
      return;
    }
    mutationInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await requestJson(`/api/tasks/${task.id}`, { method: "DELETE", headers: taskRequestHeaders() });
      showToast("Task deleted", "success");
      finishNavigation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t delete your task. Please try again.");
      setConfirmDelete(false);
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  function addTag() {
    const value = tagInput.trim().replace(/,/g, "");
    if (value && !draft.tags.includes(value)) update("tags", [...draft.tags, value]);
    setTagInput("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-5 pb-4" aria-busy={saving}>
      <fieldset disabled={saving} className="contents">
        <div>
          <label htmlFor="task-name" className={labelClass}>What needs doing?</label>
          <input id="task-name" name="task" type="text" value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g., Put mulch around the garden" required maxLength={500} className={inputClass} />
        </div>

        <section aria-label="Task photos" className="flex flex-col gap-3">
          {!!draft.photos.length && (
            <div className="flex flex-wrap gap-3">
              {draft.photos.map((url, index) => (
                <div key={url} className="relative">
                  <button type="button" onClick={() => openLightbox(draft.photos, index)} aria-label={`Open task photo ${index + 1}`} className="block rounded-xl overflow-hidden focus-visible:ring-2 focus-visible:ring-blue-600">
                    <TaskImage src={url} alt={`Task photo ${index + 1}`} width={88} height={88} sizes="88px" className="h-22 w-22 object-cover" />
                  </button>
                  <button type="button" onClick={() => update("photos", draft.photos.filter((photo) => photo !== url))} aria-label={`Remove task photo ${index + 1}`} className="absolute -top-2 -right-2 w-11 h-11 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <label className={`${secondaryButton} flex-1 flex items-center justify-center gap-2 cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
              <Camera className="w-4 h-4" aria-hidden="true" />Take photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} aria-label="Take a task photo" onChange={(e) => { const file = e.target.files?.[0]; if (file) void addPhoto(file); e.target.value = ""; }} />
            </label>
            <label className={`${secondaryButton} flex-1 flex items-center justify-center gap-2 cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
              <Plus className="w-4 h-4" aria-hidden="true" />Add photo
              <input type="file" accept="image/*" className="sr-only" disabled={busy} aria-label="Choose a task photo" onChange={(e) => { const file = e.target.files?.[0]; if (file) void addPhoto(file); e.target.value = ""; }} />
            </label>
          </div>
          <div aria-live="polite" className="text-sm text-neutral-500 dark:text-neutral-400">
            {uploadCount > 0 ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Preparing your photo…</span> : photoMessage}
          </div>
          {analysisRetry && draft.photos.includes(analysisRetry.url) && <button type="button" disabled={busy} onClick={() => void retryPhotoAnalysis()} className={`${secondaryButton} self-start`}>Retry photo suggestions</button>}
        </section>

        <div>
          <label htmlFor="task-plan-date" className={labelClass}>Plan for <span className="font-normal text-neutral-500">(optional)</span></label>
          <div className="flex gap-2 items-center">
            <input id="task-plan-date" type="date" value={draft.date} onChange={(e) => { update("date", e.target.value); if (!e.target.value) { update("endDate", ""); update("isDeadline", false); } }} className={`${inputClass} min-w-0 flex-1`} />
            {draft.date && <button type="button" onClick={() => { update("date", ""); update("endDate", ""); update("isDeadline", false); }} className={secondaryButton}>Clear</button>}
          </div>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">A date to aim for. It’s fine if plans change.</p>
          <details className="mt-2 group">
            <summary className="flex items-center gap-1 min-h-11 cursor-pointer text-sm text-neutral-600 dark:text-neutral-400 list-none">Date options<ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" /></summary>
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3">
              <label htmlFor="task-deadline" className="flex items-center gap-3 min-h-11 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <input id="task-deadline" type="checkbox" checked={draft.isDeadline && !!draft.date} disabled={!draft.date} onChange={(e) => update("isDeadline", e.target.checked)} className="h-5 w-5 accent-blue-600" />Firm deadline
              </label>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Only firm deadlines show overdue warnings.</p>
              <label htmlFor="task-end-date" className={labelClass}>End date (optional range)</label>
              <input id="task-end-date" type="date" value={draft.endDate} min={draft.date || undefined} disabled={!draft.date} onChange={(e) => update("endDate", e.target.value)} className={inputClass} />
            </div>
          </details>
        </div>

        <details className="rounded-2xl border border-neutral-200 dark:border-neutral-700 group">
          <summary className="flex justify-between items-center min-h-14 px-4 py-3 cursor-pointer text-sm font-semibold text-neutral-800 dark:text-neutral-200 list-none">More details<ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" /></summary>
          <div className="px-4 pb-4 flex flex-col gap-5">
            {mode === "edit" && <div>
              <label htmlFor="task-status" className={labelClass}>Status</label>
              <select id="task-status" value={draft.status} disabled={recurrencePending} onChange={(e) => update("status", e.target.value as Status)} className={inputClass}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
            </div>}
            <fieldset><legend className={labelClass}>Priority (optional)</legend><div className="flex gap-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">{PRIORITIES.map((value) => <button type="button" key={value} aria-pressed={draft.priority === value} onClick={() => update("priority", draft.priority === value ? "" : value as Priority)} className={`flex-1 min-h-11 rounded-lg text-sm font-medium ${draft.priority === value ? "bg-white dark:bg-neutral-700 text-neutral-950 dark:text-neutral-50" : "text-neutral-500 dark:text-neutral-400"}`}>{value}</button>)}</div></fieldset>
            <fieldset><legend className={labelClass}>Who will do it? (optional)</legend><div className="flex gap-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">{(["DIY", "Contractor"] as const).map((value) => <button type="button" key={value} aria-pressed={draft.workMode === value} onClick={() => update("workMode", draft.workMode === value ? "" : value)} className={`flex-1 min-h-11 rounded-lg text-sm font-medium ${draft.workMode === value ? "bg-white dark:bg-neutral-700 text-neutral-950 dark:text-neutral-50" : "text-neutral-500 dark:text-neutral-400"}`}>{value}</button>)}</div></fieldset>
            <div><label htmlFor="task-area" className={labelClass}>Area</label><select id="task-area" value={draft.area} onChange={(e) => update("area", e.target.value as Area | "")} className={inputClass}><option value="">No area selected</option>{AREAS.map((value) => <option key={value}>{value}</option>)}</select></div>
            <div><label htmlFor="task-sub-location" className={labelClass}>Location detail</label><input id="task-sub-location" value={draft.subLocation} onChange={(e) => update("subLocation", e.target.value)} placeholder="e.g., Front porch" className={inputClass} /></div>
            <fieldset><legend className={labelClass}>Type</legend><div className="flex flex-wrap gap-2">{TASK_TYPES.map((value) => <button key={value} type="button" aria-pressed={draft.types.includes(value)} onClick={() => update("types", draft.types.includes(value) ? draft.types.filter((type) => type !== value) : [...draft.types, value])} className={`${secondaryButton} ${draft.types.includes(value) ? "bg-neutral-100 dark:bg-neutral-700" : ""}`}>{value}</button>)}</div></fieldset>
            <div>
              <label htmlFor="task-tags" className={labelClass}>Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">{draft.tags.map((tag) => <button key={tag} type="button" onClick={() => update("tags", draft.tags.filter((value) => value !== tag))} aria-label={`Remove tag ${tag}`} className={`${secondaryButton} flex items-center gap-2`}>{tag}<X className="w-3.5 h-3.5" /></button>)}</div>
              <div className="flex gap-2"><input id="task-tags" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} placeholder="Add a tag" className={`${inputClass} min-w-0 flex-1`} /><button type="button" onClick={addTag} disabled={!tagInput.trim()} aria-label="Add tag" className={secondaryButton}><Plus className="w-5 h-5" /></button></div>
            </div>
            <div><label htmlFor="task-frequency" className={labelClass}>Repeat</label><select id="task-frequency" value={draft.frequency} onChange={(e) => update("frequency", e.target.value as Frequency | "")} className={inputClass}><option value="">Doesn’t repeat</option>{FREQUENCIES.map((value) => <option key={value}>{value}</option>)}</select></div>
            <div><label htmlFor="task-contractor" className={labelClass}>Contractor / vendor</label><input id="task-contractor" value={draft.contractor} onChange={(e) => update("contractor", e.target.value)} placeholder="Name or company" className={inputClass} /></div>
            <div><label htmlFor="task-estimate" className={labelClass}>Estimated cost ($)</label><input id="task-estimate" type="number" inputMode="decimal" value={draft.estimate} onChange={(e) => update("estimate", e.target.value)} placeholder="Optional" min="0" step="0.01" className={inputClass} /></div>
            {mode === "edit" && <div><label htmlFor="task-actual" className={labelClass}>Actual cost ($)</label><input id="task-actual" type="number" inputMode="decimal" value={draft.actual} onChange={(e) => update("actual", e.target.value)} placeholder="Optional" min="0" step="0.01" className={inputClass} /></div>}
            {mode === "edit" && (draft.status === "Completed" || task?.status === "Completed") && <div><label htmlFor="task-completed-date" className={labelClass}>Completed on (optional)</label><input id="task-completed-date" type="date" value={draft.completedDate} onChange={(e) => update("completedDate", e.target.value)} className={inputClass} /><p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Leave blank if the completion date is unknown.</p></div>}
            <div><label htmlFor="task-notes" className={labelClass}>Notes</label><textarea id="task-notes" value={draft.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Anything worth remembering…" rows={4} className={`${inputClass} resize-y`} /></div>
            {completionPhotos.length > 0 && <div><p className={labelClass}>Completion photos</p><div className="flex flex-wrap gap-2">{completionPhotos.map((url, index) => <button key={url} type="button" aria-label={`Open completion photo ${index + 1}`} onClick={() => openLightbox(completionPhotos, index)}><TaskImage src={url} alt={`Completion photo ${index + 1}`} width={88} height={88} sizes="88px" className="h-22 w-22 rounded-xl object-cover" /></button>)}</div></div>}
            {mode === "edit" && <button type="button" onClick={handleDelete} disabled={busy} className="min-h-11 text-sm font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">{confirmDelete ? "Tap again to permanently delete" : "Delete task"}</button>}
          </div>
        </details>

        {mode === "edit" && (draft.status !== "Completed" || showCompletePhoto) && !recurrencePending && (
          <div className="flex flex-col gap-3">
            {!showCompletePhoto ? <button type="button" onClick={() => setShowCompletePhoto(true)} disabled={busy} className={secondaryButton}>Mark complete</button> : <section ref={completionReview} tabIndex={-1} aria-label="Review task completion" className="flex flex-col gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              {earlyCompletionDate && <p id="early-repeat-warning" className="text-sm font-medium">This repeat is planned for {formatPlannedDate(earlyCompletionDate)}. Complete it early?</p>}
              <p className="text-sm font-medium">Add a completion photo? (optional)</p>
              {afterPhotoUrl ? <button type="button" onClick={() => openLightbox([afterPhotoUrl])} aria-label="Open new completion photo"><TaskImage src={afterPhotoUrl} alt="New completion photo" width={360} height={200} sizes="(max-width: 512px) 80vw, 360px" className="w-full max-h-48 object-contain rounded-xl" /></button> : <label className={`${secondaryButton} flex items-center justify-center gap-2 cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}><Camera className="w-4 h-4" />Add photo<input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} aria-label="Add completion photo" onChange={(e) => { const file = e.target.files?.[0]; if (file) void addPhoto(file, true); e.target.value = ""; }} /></label>}
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Completing also saves your current edits.</p>
              <div className="flex gap-2"><button type="button" disabled={busy} onClick={cancelCompletion} className={`${secondaryButton} flex-1`}>Cancel</button><button type="button" disabled={busy || !draft.name.trim()} aria-describedby={earlyCompletionDate ? "early-repeat-warning" : undefined} onClick={() => void saveTask(true, !!earlyCompletionDate)} className="min-h-11 flex-1 px-3 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">{saving ? "Saving…" : earlyCompletionDate ? "Complete this repeat early" : "Complete task"}</button></div>
            </section>}
          </div>
        )}
      </fieldset>

      <fieldset disabled={busy} className="contents">{children}</fieldset>

      {(!showCompletePhoto || recurrencePending || error) && <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-5 px-5 py-3 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 z-30">
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300 mb-3">{error}</p>}
        {(!showCompletePhoto || recurrencePending) && <button type="submit" disabled={busy || !draft.name.trim()} className="w-full min-h-12 py-3 rounded-xl bg-blue-600 text-white font-semibold text-base disabled:opacity-50 hover:bg-blue-700 transition-colors">{saving ? "Saving…" : uploadCount ? "Waiting for photo…" : recurrencePending ? "Retry scheduling" : mode === "create" ? "Save task" : "Save changes"}</button>}
      </div>}
    </form>
  );
}

function localToday(): string {
  return householdDateKey();
}

function formatPlannedDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}
