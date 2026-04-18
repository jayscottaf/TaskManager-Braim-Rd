"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, Loader2, ArrowLeft, Pencil, Copy, ChevronRight, Archive,
  ArchiveRestore, Trash2, Eye, EyeOff, ArrowUpDown, Rocket, CalendarPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WishListItem } from "@/lib/wishlist";
import type { WishListPlan } from "@/lib/ai";
import { ProjectPlanner } from "@/components/project-planner";
import { CostSummary } from "@/components/cost-summary";
import { RoiBadge } from "@/components/roi-badge";

const SEASON_ICONS: Record<string, string> = {
  Spring: "🌸", Summer: "☀️", Fall: "🍂", Winter: "❄️", Any: "📅",
};

const CATEGORIES = ["Landscaping", "Driveway", "Interior", "Exterior", "Roofing", "Plumbing", "Electrical", "General"];
const PRIORITIES = ["High", "Medium", "Low"];
const TIMELINES = ["This Year", "Next Year", "2+ Years", "Someday"];
const SEASONS = ["Spring", "Summer", "Fall", "Winter", "Any"];

type SortKey = "cost" | "roi" | "priority";

export default function WishListPage() {
  const [items, setItems] = useState<WishListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>("cost");
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WishListItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [confirmDeleteWish, setConfirmDeleteWish] = useState(false);
  const [promoteDate, setPromoteDate] = useState("");
  const [promoteEndDate, setPromoteEndDate] = useState("");
  const router = useRouter();

  // Form state for add/edit
  const [formData, setFormData] = useState<Record<string, string>>({});

  const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
  const headers = (extra?: Record<string, string>) => ({
    "Content-Type": "application/json",
    ...(secret ? { "x-app-secret": secret } : {}),
    ...extra,
  });

  const loadItems = useCallback(async (archived = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wishlist${archived ? "?archived=true" : ""}`, {
        headers: secret ? { "x-app-secret": secret } : {},
      });
      if (res.ok) setItems(await res.json());
    } catch {
      setError("Failed to load wish list");
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => { loadItems(); }, [loadItems]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handlePlanned(plan: WishListPlan, photoUrls: string[]) {
    setFormData({
      project: plan.project,
      description: plan.description,
      aiPlan: plan.plan,
      diyCost: String(plan.diyCost),
      hiredCost: String(plan.hiredCost),
      valueAdd: String(plan.valueAdd),
      diyRoi: String(plan.diyRoi),
      hiredRoi: String(plan.hiredRoi),
      diyRoiRating: plan.diyRoiRating,
      hiredRoiRating: plan.hiredRoiRating,
      diyDifficulty: plan.diyDifficulty,
      costMode: "DIY",
      category: plan.category,
      priority: plan.priority,
      timeline: plan.timeline,
      bestSeason: plan.bestSeason,
      ...(photoUrls.length > 0 ? { photos: JSON.stringify(photoUrls) } : {}),
    });
  }

  async function handleSave() {
    if (!formData.project?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        project: formData.project,
        description: formData.description || undefined,
        aiPlan: formData.aiPlan || undefined,
        diyCost: formData.diyCost ? Number(formData.diyCost) : undefined,
        hiredCost: formData.hiredCost ? Number(formData.hiredCost) : undefined,
        valueAdd: formData.valueAdd ? Number(formData.valueAdd) : undefined,
        diyRoi: formData.diyRoi ? Number(formData.diyRoi) : undefined,
        hiredRoi: formData.hiredRoi ? Number(formData.hiredRoi) : undefined,
        diyRoiRating: formData.diyRoiRating || undefined,
        hiredRoiRating: formData.hiredRoiRating || undefined,
        diyDifficulty: formData.diyDifficulty || undefined,
        costMode: formData.costMode || "DIY",
        category: formData.category || undefined,
        priority: formData.priority || undefined,
        timeline: formData.timeline || undefined,
        bestSeason: formData.bestSeason || undefined,
        photos: formData.photos ? JSON.parse(formData.photos) : undefined,
        notes: formData.notes || undefined,
      };
      const res = await fetch("/api/wishlist", {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowForm(false);
      setFormData({});
      loadItems(showArchived);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedItem || !formData.project?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        project: formData.project,
        description: formData.description || "",
        aiPlan: formData.aiPlan || "",
        diyCost: formData.diyCost ? Number(formData.diyCost) : null,
        hiredCost: formData.hiredCost ? Number(formData.hiredCost) : null,
        valueAdd: formData.valueAdd ? Number(formData.valueAdd) : null,
        diyRoi: formData.diyRoi ? Number(formData.diyRoi) : null,
        hiredRoi: formData.hiredRoi ? Number(formData.hiredRoi) : null,
        diyRoiRating: formData.diyRoiRating || null,
        hiredRoiRating: formData.hiredRoiRating || null,
        diyDifficulty: formData.diyDifficulty || null,
        costMode: formData.costMode || "DIY",
        category: formData.category || null,
        priority: formData.priority || null,
        timeline: formData.timeline || null,
        bestSeason: formData.bestSeason || null,
        photos: formData.photos ? JSON.parse(formData.photos) : [],
        notes: formData.notes || "",
      };
      const res = await fetch(`/api/wishlist/${selectedItem.id}`, {
        method: "PATCH", headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      setSelectedItem(null);
      loadItems(showArchived);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(id: string, action: "archive" | "restore") {
    try {
      await fetch(`/api/wishlist/${id}`, {
        method: "PATCH", headers: headers(),
        body: JSON.stringify({ _action: action }),
      });
      setSelectedItem(null);
      loadItems(showArchived);
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/wishlist/${id}`, {
        method: "DELETE", headers: headers(),
      });
      setSelectedItem(null);
      loadItems(showArchived);
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleDuplicate(item: WishListItem) {
    setSaving(true);
    setError(null);
    try {
      const body = {
        project: `Copy of ${item.project}`,
        description: item.description || undefined,
        aiPlan: item.aiPlan || undefined,
        diyCost: item.diyCost ?? undefined,
        hiredCost: item.hiredCost ?? undefined,
        valueAdd: item.valueAdd ?? undefined,
        diyRoi: item.diyRoi ?? undefined,
        hiredRoi: item.hiredRoi ?? undefined,
        diyRoiRating: item.diyRoiRating || undefined,
        hiredRoiRating: item.hiredRoiRating || undefined,
        diyDifficulty: item.diyDifficulty || undefined,
        costMode: item.costMode || undefined,
        category: item.category || undefined,
        priority: item.priority || undefined,
        timeline: item.timeline || undefined,
        bestSeason: item.bestSeason || undefined,
        photos: item.photos.length > 0 ? item.photos : undefined,
        notes: item.notes || undefined,
      };
      await fetch("/api/wishlist", {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      });
      setSelectedItem(null);
      loadItems(showArchived);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Map wish list category to task area/type
  const CATEGORY_TO_AREA: Record<string, string> = {
    Landscaping: "Garden", Driveway: "Driveway/Walkway", Interior: "Living Room",
    Exterior: "Exterior", Roofing: "Roof", Plumbing: "Bathroom",
    Electrical: "Living Room", General: "Exterior",
  };
  const CATEGORY_TO_TYPE: Record<string, string> = {
    Landscaping: "Landscaping", Driveway: "General Repair", Interior: "Carpentry",
    Exterior: "Carpentry", Roofing: "General Repair", Plumbing: "Plumbing",
    Electrical: "Electrical", General: "General Repair",
  };

  async function handlePromote(item: WishListItem) {
    if (!promoteDate) return;
    setSaving(true);
    setError(null);
    try {
      const activeRating = item.costMode === "Hired Out" ? item.hiredRoiRating : item.diyRoiRating;
      const activeRoi = item.costMode === "Hired Out" ? item.hiredRoi : item.diyRoi;
      const activeCost = item.costMode === "Hired Out" ? item.hiredCost : item.diyCost;
      const notes = [
        item.description,
        item.aiPlan ? `\nAI Plan:\n${item.aiPlan}` : "",
        `\nMode: ${item.costMode}`,
        item.diyCost != null ? `\nDIY Cost: $${item.diyCost.toLocaleString()}` : "",
        item.hiredCost != null ? `\nHired Cost: $${item.hiredCost.toLocaleString()}` : "",
        activeRating ? `\nROI: ${activeRoi ?? "?"}% (${activeRating})` : "",
        item.diyDifficulty ? `\nDIY Difficulty: ${item.diyDifficulty}` : "",
        item.bestSeason ? `\nBest Season: ${item.bestSeason}` : "",
        item.notes ? `\nNotes: ${item.notes}` : "",
      ].filter(Boolean).join("");

      const body = {
        task: item.project,
        status: "Not Started",
        priority: item.priority || "Medium",
        area: CATEGORY_TO_AREA[item.category || "General"] || "Exterior",
        type: [CATEGORY_TO_TYPE[item.category || "General"] || "General Repair"],
        frequency: "One-time",
        costEstimate: activeCost || 0,
        dueDate: { start: promoteDate, ...(promoteEndDate ? { end: promoteEndDate } : {}) },
        notes: notes.slice(0, 2000),
      };

      const res = await fetch("/api/tasks", {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create task");

      setPromoting(false);
      setPromoteDate("");
      setPromoteEndDate("");
      setSelectedItem(null);
      router.push("/calendar");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Sorted items
  const gc = (i: WishListItem) => (i.costMode === "Hired Out" ? i.hiredCost : i.diyCost) || 0;
  const gr = (i: WishListItem) => (i.costMode === "Hired Out" ? i.hiredRoi : i.diyRoi) || 0;
  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "cost") return gc(b) - gc(a);
    if (sortBy === "roi") return gr(b) - gr(a);
    const priOrder = { High: 3, Medium: 2, Low: 1 };
    return (priOrder[b.priority as keyof typeof priOrder] || 0) - (priOrder[a.priority as keyof typeof priOrder] || 0);
  });

  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow";

  function roiRating(roi: number): string {
    return roi > 100 ? "High ROI" : roi >= 50 ? "Good" : roi > 0 ? "Low" : "Lifestyle";
  }

  function set(key: string, val: string) {
    setFormData((prev) => {
      const next = { ...prev, [key]: val };
      // Auto-recalculate BOTH ROIs when any cost or value add changes
      if (key === "diyCost" || key === "hiredCost" || key === "valueAdd") {
        const diy = Number(key === "diyCost" ? val : next.diyCost) || 0;
        const hired = Number(key === "hiredCost" ? val : next.hiredCost) || 0;
        const value = Number(key === "valueAdd" ? val : next.valueAdd) || 0;
        if (diy > 0) {
          const r = Math.round((value / diy) * 100);
          next.diyRoi = String(r);
          next.diyRoiRating = roiRating(r);
        } else {
          next.diyRoi = "";
          next.diyRoiRating = "";
        }
        if (hired > 0) {
          const r = Math.round((value / hired) * 100);
          next.hiredRoi = String(r);
          next.hiredRoiRating = roiRating(r);
        } else {
          next.hiredRoi = "";
          next.hiredRoiRating = "";
        }
      }
      return next;
    });
  }

  function renderForm(submitLabel: string, onSubmit: () => void) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Project *</label>
          <input type="text" value={formData.project || ""} onChange={(e) => set("project", e.target.value)} placeholder="Project name" required className={inputClass} />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Description</label>
          <textarea value={formData.description || ""} onChange={(e) => set("description", e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">AI Plan</label>
          <textarea value={formData.aiPlan || ""} onChange={(e) => set("aiPlan", e.target.value)} rows={6} className={`${inputClass} font-mono text-xs`} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">DIY Cost</label>
            <input type="number" value={formData.diyCost || ""} onChange={(e) => set("diyCost", e.target.value)} min="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Hired Cost</label>
            <input type="number" value={formData.hiredCost || ""} onChange={(e) => set("hiredCost", e.target.value)} min="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Value Add</label>
            <input type="number" value={formData.valueAdd || ""} onChange={(e) => set("valueAdd", e.target.value)} min="0" className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">DIY ROI</label>
            <input type="text" value={formData.diyRoi ? `${formData.diyRoi}%` : ""} readOnly className={`${inputClass} bg-neutral-50 dark:bg-neutral-850 text-neutral-400`} />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Hired ROI</label>
            <input type="text" value={formData.hiredRoi ? `${formData.hiredRoi}%` : ""} readOnly className={`${inputClass} bg-neutral-50 dark:bg-neutral-850 text-neutral-400`} />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">DIY Difficulty</label>
            <select value={formData.diyDifficulty || ""} onChange={(e) => set("diyDifficulty", e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              <option value="Easy">Easy</option>
              <option value="Moderate">Moderate</option>
              <option value="Hard">Hard</option>
              <option value="Pro Only">Pro Only</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Cost Mode</label>
            <select value={formData.costMode || "DIY"} onChange={(e) => set("costMode", e.target.value)} className={inputClass}>
              <option value="DIY">DIY</option>
              <option value="Hired Out">Hired Out</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Category</label>
            <select value={formData.category || ""} onChange={(e) => set("category", e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Priority</label>
            <select value={formData.priority || ""} onChange={(e) => set("priority", e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Timeline</label>
            <select value={formData.timeline || ""} onChange={(e) => set("timeline", e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Best Season</label>
            <select value={(formData.bestSeason || "").split("(")[0].trim()} onChange={(e) => set("bestSeason", e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Notes</label>
          <textarea value={formData.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Contractor quotes, links, ideas..." className={inputClass} />
        </div>
        <button
          onClick={onSubmit}
          disabled={saving || !formData.project?.trim()}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-blue-700 active:scale-[0.99] transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : submitLabel}
        </button>
      </div>
    );
  }

  // --- DETAIL VIEW ---
  if (selectedItem) {
    const isArchived = selectedItem._status === "Archived";

    if (editing) {
      return (
        <div className="flex flex-col gap-5 pt-6 pb-24 animate-fade-in">
          <div className="px-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setEditing(false)} className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              </button>
              <h1 className="text-xl font-bold text-neutral-950 dark:text-neutral-50">Edit Project</h1>
            </div>
          </div>
          {error && <div className="mx-5 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-sm text-red-600">{error}</div>}
          <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
            {renderForm("Save Changes", handleUpdate)}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5 pt-6 pb-24 animate-fade-in">
        <div className="px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedItem(null); setEditing(false); }} className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
                {selectedItem.project}
              </h1>
              {isArchived && <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Archived</span>}
            </div>
          </div>
          {!isArchived && (
            <div className="flex items-center gap-2">
              <button onClick={() => handleDuplicate(selectedItem)} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50">
                <Copy className="w-4 h-4" /> Duplicate
              </button>
              <button onClick={() => {
                setFormData({
                  project: selectedItem.project,
                  description: selectedItem.description || "",
                  aiPlan: selectedItem.aiPlan || "",
                  diyCost: selectedItem.diyCost != null ? String(selectedItem.diyCost) : "",
                  hiredCost: selectedItem.hiredCost != null ? String(selectedItem.hiredCost) : "",
                  valueAdd: selectedItem.valueAdd != null ? String(selectedItem.valueAdd) : "",
                  diyRoi: selectedItem.diyRoi != null ? String(selectedItem.diyRoi) : "",
                  hiredRoi: selectedItem.hiredRoi != null ? String(selectedItem.hiredRoi) : "",
                  diyRoiRating: selectedItem.diyRoiRating || "",
                  hiredRoiRating: selectedItem.hiredRoiRating || "",
                  diyDifficulty: selectedItem.diyDifficulty || "",
                  costMode: selectedItem.costMode || "DIY",
                  category: selectedItem.category || "",
                  priority: selectedItem.priority || "",
                  timeline: selectedItem.timeline || "",
                  bestSeason: selectedItem.bestSeason || "",
                  photos: selectedItem.photos.length > 0 ? JSON.stringify(selectedItem.photos) : "",
                  notes: selectedItem.notes || "",
                });
                setEditing(true);
              }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </div>
          )}
        </div>

        {error && <div className="mx-5 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-sm text-red-600">{error}</div>}

        <div className="flex flex-col gap-4 mx-5">
          {selectedItem.photos.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm overflow-hidden">
              {selectedItem.photos.length === 1 ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={selectedItem.photos[0]} alt={selectedItem.project} className="w-full object-contain max-h-72" />
              ) : (
                <div className="flex gap-1 overflow-x-auto snap-x snap-mandatory">
                  {selectedItem.photos.map((url, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={i} src={url} alt={`${selectedItem.project} ${i + 1}`} className="w-full flex-shrink-0 snap-center object-contain max-h-72" />
                  ))}
                </div>
              )}
              {selectedItem.photos.length > 1 && (
                <p className="text-center text-[10px] text-neutral-400 py-1">Swipe for more photos ({selectedItem.photos.length})</p>
              )}
            </div>
          )}

          {/* DIY vs Hired Toggle + Cost Comparison */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
            {/* Toggle */}
            <div className="flex rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
              {(["DIY", "Hired Out"] as const).map((mode) => (
                <button key={mode} onClick={async () => {
                  const updated = { ...selectedItem, costMode: mode };
                  setSelectedItem(updated);
                  setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
                  await fetch(`/api/wishlist/${selectedItem.id}`, {
                    method: "PATCH", headers: headers(),
                    body: JSON.stringify({ costMode: mode }),
                  }).catch(() => {});
                }}
                  className={`flex-1 py-2 text-sm font-semibold text-center transition-colors ${selectedItem.costMode === mode ? "bg-blue-600 text-white" : "text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}>
                  {mode === "DIY" ? "🔧 DIY" : "👷 Hired Out"}
                </button>
              ))}
            </div>

            {/* Side-by-side */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`text-center p-3 rounded-xl ${selectedItem.costMode === "DIY" ? "bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-500" : ""}`}>
                <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">DIY</p>
                <p className="text-lg font-bold text-neutral-950 dark:text-neutral-50">
                  {selectedItem.diyCost != null ? `$${selectedItem.diyCost.toLocaleString()}` : "—"}
                </p>
                {selectedItem.diyCost != null ? (
                  <RoiBadge rating={selectedItem.diyRoiRating} roi={selectedItem.diyRoi} size="sm" />
                ) : (
                  <p className="text-[10px] text-neutral-400">Edit to add cost</p>
                )}
                {selectedItem.diyDifficulty && (
                  <p className={`text-[10px] font-semibold mt-1 ${selectedItem.diyDifficulty === "Easy" ? "text-emerald-600" : selectedItem.diyDifficulty === "Moderate" ? "text-amber-600" : selectedItem.diyDifficulty === "Hard" ? "text-red-600" : "text-neutral-900 dark:text-neutral-100"}`}>
                    {selectedItem.diyDifficulty === "Pro Only" ? "⚠️ Pro Only" : selectedItem.diyDifficulty + " DIY"}
                  </p>
                )}
              </div>
              <div className={`text-center p-3 rounded-xl ${selectedItem.costMode === "Hired Out" ? "bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-500" : ""}`}>
                <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Hired Out</p>
                <p className="text-lg font-bold text-neutral-950 dark:text-neutral-50">
                  {selectedItem.hiredCost != null ? `$${selectedItem.hiredCost.toLocaleString()}` : "—"}
                </p>
                {selectedItem.hiredCost != null ? (
                  <RoiBadge rating={selectedItem.hiredRoiRating} roi={selectedItem.hiredRoi} size="sm" />
                ) : (
                  <p className="text-[10px] text-neutral-400">Edit to add cost</p>
                )}
              </div>
            </div>

            {/* Value Add + Savings */}
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Value Add</p>
              <p className="text-lg font-bold text-emerald-600">
                {selectedItem.valueAdd != null ? `$${selectedItem.valueAdd.toLocaleString()}` : "—"}
              </p>
              {selectedItem.diyCost != null && selectedItem.hiredCost != null && selectedItem.hiredCost > selectedItem.diyCost && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  You save ${(selectedItem.hiredCost - selectedItem.diyCost).toLocaleString()} doing it yourself ({Math.round(((selectedItem.hiredCost - selectedItem.diyCost) / selectedItem.hiredCost) * 100)}% less)
                </p>
              )}
            </div>
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2">
            {selectedItem.category && (
              <span className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">{selectedItem.category}</span>
            )}
            {selectedItem.priority && (
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${selectedItem.priority === "High" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" : selectedItem.priority === "Medium" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                {selectedItem.priority} Priority
              </span>
            )}
            {selectedItem.timeline && (
              <span className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">{selectedItem.timeline}</span>
            )}
            {selectedItem.bestSeason && (
              <span className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">
                {SEASON_ICONS[selectedItem.bestSeason] || "📅"} Best: {selectedItem.bestSeason}
              </span>
            )}
          </div>

          {/* Description */}
          {selectedItem.description && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1">Description</p>
              <p className="text-sm text-neutral-800 dark:text-neutral-200">{selectedItem.description}</p>
            </div>
          )}

          {/* AI Plan */}
          {selectedItem.aiPlan && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-2">Project Plan</p>
              <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">{selectedItem.aiPlan}</p>
            </div>
          )}

          {/* Notes */}
          {selectedItem.notes && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1">Notes</p>
              <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">{selectedItem.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {isArchived ? (
              <div className="flex gap-2">
                <button onClick={() => handleAction(selectedItem.id, "restore")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30 active:scale-[0.98] transition-all">
                  <ArchiveRestore className="w-4 h-4" /> Restore
                </button>
                <button onClick={() => {
                    if (!confirmDeleteWish) { setConfirmDeleteWish(true); setTimeout(() => setConfirmDeleteWish(false), 3000); return; }
                    handleDelete(selectedItem.id); setConfirmDeleteWish(false);
                  }}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium active:scale-[0.98] transition-all ${
                    confirmDeleteWish
                      ? "bg-red-600 border-red-600 text-white"
                      : "border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  }`}>
                  <Trash2 className="w-4 h-4" /> {confirmDeleteWish ? "Confirm" : ""}
                </button>
              </div>
            ) : (
              <>
                {/* Start This Project */}
                {!promoting ? (
                  <button onClick={() => { setPromoting(true); setPromoteDate(""); setPromoteEndDate(""); }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all">
                    <Rocket className="w-4 h-4" /> Start This Project
                  </button>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-4 flex flex-col gap-3 border border-emerald-200 dark:border-emerald-900">
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4" /> Schedule it — add to your task list & calendar
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">Start Date *</label>
                        <input type="date" value={promoteDate} onChange={(e) => setPromoteDate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">End Date</label>
                        <input type="date" value={promoteEndDate} onChange={(e) => setPromoteEndDate(e.target.value)} min={promoteDate}
                          className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setPromoting(false)}
                        className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.98] transition-all">
                        Cancel
                      </button>
                      <button onClick={() => handlePromote(selectedItem)} disabled={saving || !promoteDate}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CalendarPlus className="w-4 h-4" /> Add to Calendar</>}
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={() => handleAction(selectedItem.id, "archive")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-950/30 active:scale-[0.98] transition-all">
                  <Archive className="w-4 h-4" /> Archive
                </button>
                <button onClick={() => {
                    if (!confirmDeleteWish) { setConfirmDeleteWish(true); setTimeout(() => setConfirmDeleteWish(false), 3000); return; }
                    handleDelete(selectedItem.id); setConfirmDeleteWish(false);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs transition-all ${
                    confirmDeleteWish
                      ? "bg-red-600 text-white font-medium"
                      : "text-neutral-400 hover:text-red-500"
                  }`}>
                  <Trash2 className="w-3.5 h-3.5" /> {confirmDeleteWish ? "Tap again to delete" : "Delete permanently"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="flex flex-col gap-5 pt-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">Wish List</h1>
          </div>
          <button onClick={() => { setShowForm(!showForm); setFormData({}); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add"}
          </button>
        </div>
        <p className="text-sm text-neutral-400 mt-0.5 ml-12">Dream projects for Braim Rd</p>
      </div>

      {error && <div className="mx-5 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-sm text-red-600">{error}</div>}

      {/* Add form */}
      {showForm && (
        <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <ProjectPlanner onPlanned={handlePlanned} />
          {formData.project && (
            <>
              <div className="h-px bg-neutral-200 dark:bg-neutral-700" />
              <p className="text-xs text-emerald-600 font-medium">AI plan generated — review and save below</p>
              {renderForm("Save to Wish List", handleSave)}
            </>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mx-5 flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                for (const id of selectedIds) await handleAction(id, "archive");
                setSelectedIds(new Set());
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-neutral-500 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Cost Summary */}
      {!loading && items.length > 0 && <CostSummary items={items} selectedIds={selectedIds} />}

      {/* Sort + Archive toggle */}
      {!showForm && !loading && items.length > 0 && (
        <div className="px-5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
            {(["cost", "roi", "priority"] as SortKey[]).map((key) => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${sortBy === key ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "text-neutral-400 hover:text-neutral-600"}`}>
                {key === "cost" ? "Cost" : key === "roi" ? "ROI" : "Priority"}
              </button>
            ))}
          </div>
          <button onClick={() => { const next = !showArchived; setShowArchived(next); loadItems(next); }}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
            {showArchived ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
      )}

      {/* Items */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">✨</div>
          <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">No dream projects yet</p>
          <p className="text-sm text-neutral-400 mt-1">Tap Add to plan your first project</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          {sortedItems.map((item) => {
            const isArchived = item._status === "Archived";
            const isSelected = selectedIds.has(item.id);
            return (
              <div key={item.id} className={`bg-white dark:bg-neutral-900 rounded-2xl shadow-sm overflow-hidden transition-all ${isArchived ? "opacity-50" : ""}`}>
                {item.photos.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photos[0]} alt={item.project} className="w-full h-32 object-cover cursor-pointer" onClick={() => setSelectedItem(item)} />
                )}
                <div className="flex items-start gap-3 p-4">
                  {/* Checkbox */}
                  <button onClick={() => toggleSelect(item.id)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-neutral-300 dark:border-neutral-600"}`}>
                    {isSelected && <span className="text-xs font-bold">✓</span>}
                  </button>

                  {/* Content */}
                  <button onClick={() => setSelectedItem(item)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-[15px] font-semibold text-neutral-950 dark:text-neutral-50 truncate">{item.project}</h3>
                        {isArchived && <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded flex-shrink-0">Archived</span>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.category && <span className="text-xs text-neutral-500">{item.category}</span>}
                      {gc(item) > 0 && <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">${gc(item).toLocaleString()}</span>}
                      {gc(item) > 0 && <RoiBadge rating={item.costMode === "Hired Out" ? item.hiredRoiRating : item.diyRoiRating} roi={item.costMode === "Hired Out" ? item.hiredRoi : item.diyRoi} />}
                      <span className="text-[10px] text-neutral-400">{item.costMode === "Hired Out" ? "👷" : "🔧"}</span>
                      {item.bestSeason && <span className="text-xs text-neutral-400">{SEASON_ICONS[item.bestSeason] || ""} {item.bestSeason}</span>}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
