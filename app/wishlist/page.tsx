"use client";

import { useState, useEffect, useCallback, useId, useRef } from "react";
import {
  Plus, X, Loader2, ArrowLeft, Pencil, Copy, ChevronRight, Archive,
  ArchiveRestore, Trash2, Eye, EyeOff, ArrowUpDown, Rocket, CalendarPlus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WishListItem } from "@/lib/wishlist";
import type { WishListPlan } from "@/lib/ai";
import { PageMenu } from "@/components/page-menu";
import { openLightbox } from "@/components/lightbox";
import { ProjectPlanner } from "@/components/project-planner";
import { CostSummary } from "@/components/cost-summary";
import { RoiBadge } from "@/components/roi-badge";
import { TaskImage } from "@/components/task-image";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>("cost");
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WishListItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [aiDraftReady, setAiDraftReady] = useState(false);
  const loadVersion = useRef(0);
  const [estimatingCost, setEstimatingCost] = useState(false);
  const [confirmDeleteWish, setConfirmDeleteWish] = useState(false);
  const [promoteDate, setPromoteDate] = useState("");
  const [promoteEndDate, setPromoteEndDate] = useState("");
  const router = useRouter();
  const formId = useId();

  // Form state for add/edit
  const [formData, setFormData] = useState<Record<string, string>>({});

  const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
  const headers = (extra?: Record<string, string>) => ({
    "Content-Type": "application/json",
    ...(secret ? { "x-app-secret": secret } : {}),
    ...extra,
  });

  const loadItems = useCallback(async (archived = false) => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/wishlist${archived ? "?archived=true" : ""}`, {
        headers: secret ? { "x-app-secret": secret } : {},
      });
      if (!res.ok) throw new Error("Failed to load wish list. Try again.");
      const data: WishListItem[] = await res.json();
      if (version !== loadVersion.current) return;
      setItems(data);
      setError(null);
    } catch {
      if (version === loadVersion.current) setError("Failed to load wish list. Try again.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
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
    setFormData((previous) => ({
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
      ...Object.fromEntries(Object.entries(previous).filter(([, value]) => value !== "")),
      photos: JSON.stringify([...new Set([...(previous.photos ? JSON.parse(previous.photos) : []), ...photoUrls])]),
    }));
    setAiDraftReady(true);
  }

  async function handleSave() {
    if (saving || plannerBusy || !formData.project?.trim()) return;
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
        tags: formData.tags ? formData.tags.split(",").filter(Boolean) : undefined,
        notes: formData.notes || undefined,
      };
      const res = await fetch("/api/wishlist", {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowForm(false);
      setFormData({});
      await loadItems(showArchived);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (saving || !selectedItem || !formData.project?.trim()) return;
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
        tags: formData.tags ? formData.tags.split(",").filter(Boolean) : [],
        notes: formData.notes || "",
      };
      const res = await fetch(`/api/wishlist/${selectedItem.id}`, {
        method: "PATCH", headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      setSelectedItem(null);
      await loadItems(showArchived);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(id: string, action: "archive" | "restore") {
    if (saving) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wishlist/${id}`, {
        method: "PATCH", headers: headers(),
        body: JSON.stringify({ _action: action }),
      });
      if (!res.ok) throw new Error(`Couldn’t ${action} this idea. Try again.`);
      setSelectedItem(null);
      await loadItems(showArchived);
      return true;
    } catch (e: unknown) { setError((e as Error).message); return false; }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wishlist/${id}`, {
        method: "DELETE", headers: headers(),
      });
      if (!res.ok) throw new Error("Couldn’t delete this idea. Try again.");
      setSelectedItem(null);
      await loadItems(showArchived);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDuplicate(item: WishListItem) {
    if (saving) return;
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
        tags: item.tags.length > 0 ? item.tags : undefined,
        notes: item.notes || undefined,
      };
      const res = await fetch("/api/wishlist", {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Couldn’t duplicate this idea. Try again.");
      setSelectedItem(null);
      await loadItems(showArchived);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePromote(item: WishListItem) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wishlist/${item.id}/promote`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ ...(promoteDate ? { date: { start: promoteDate, ...(promoteEndDate ? { end: promoteEndDate } : {}) } } : {}) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't move this idea. Retry to finish safely.");
      const result = await res.json();
      setPromoting(false);
      setPromoteDate("");
      setPromoteEndDate("");
      setSelectedItem(null);
      router.push(`/task/${result.taskId}`);
      router.refresh();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  function editData(item: WishListItem): Record<string, string> {
    return Object.fromEntries(Object.entries(item).filter(([, value]) => value != null).map(([key, value]) => [key, key === "photos" ? JSON.stringify(value) : Array.isArray(value) ? value.join(",") : String(value)]));
  }

  async function changeCostMode(item: WishListItem, mode: string) {
    if (saving || item.costMode === mode) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wishlist/${item.id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ costMode: mode }) });
      if (!res.ok) throw new Error("Couldn't save the cost choice. Try again.");
      const updated = { ...item, costMode: mode };
      setSelectedItem(updated);
      setItems((prev) => prev.map((row) => row.id === item.id ? updated : row));
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleAiCostEstimate(item: WishListItem) {
    setEstimatingCost(true);
    setError(null);
    try {
      const description = [
        `Project: ${item.project}`,
        item.description ? `Description: ${item.description}` : "",
        item.aiPlan ? `Existing plan: ${item.aiPlan}` : "",
        item.category ? `Category: ${item.category}` : "",
        item.priority ? `Priority: ${item.priority}` : "",
        item.timeline ? `Timeline: ${item.timeline}` : "",
        item.bestSeason ? `Best season: ${item.bestSeason}` : "",
        item.diyCost != null ? `Current DIY cost: $${item.diyCost}` : "",
        item.hiredCost != null ? `Current hired out cost: $${item.hiredCost}` : "",
        item.valueAdd != null ? `Current value add: $${item.valueAdd}` : "",
        "Re-estimate the DIY cost, hired out contractor cost, value add, ROI, and DIY difficulty for Saratoga Springs, NY pricing.",
      ].filter(Boolean).join("\n");

      const form = new FormData();
      form.append("description", description);

      const planRes = await fetch("/api/ai/plan-project", {
        method: "POST",
        headers: secret ? { "x-app-secret": secret } : {},
        body: form,
      });
      if (!planRes.ok) throw new Error((await planRes.json()).error || "AI estimate failed");

      const plan: WishListPlan = await planRes.json();
      const body = {
        diyCost: plan.diyCost,
        hiredCost: plan.hiredCost,
        valueAdd: plan.valueAdd,
        diyRoi: plan.diyRoi,
        hiredRoi: plan.hiredRoi,
        diyRoiRating: plan.diyRoiRating,
        hiredRoiRating: plan.hiredRoiRating,
        diyDifficulty: plan.diyDifficulty,
        category: item.category || plan.category,
        priority: item.priority || plan.priority,
        timeline: item.timeline || plan.timeline,
        bestSeason: item.bestSeason || plan.bestSeason,
      };

      // Review estimates before explicitly saving them to the idea.
      setFormData(editData({ ...item, ...body }));
      setAiDraftReady(true);
      setEditing(true);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to estimate cost");
    } finally {
      setEstimatingCost(false);
    }
  }

  // Sorted items
  const gc = (i: WishListItem) => (i.costMode === "Hired Out" ? i.hiredCost : i.diyCost) || 0;
  const gr = (i: WishListItem) => (i.costMode === "Hired Out" ? i.hiredRoi : i.diyRoi) || 0;
  const filteredItems = searchQuery
    ? items.filter((i) => {
        const q = searchQuery.toLowerCase();
        return (
          i.project.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)) ||
          i.description?.toLowerCase().includes(q)
        );
      })
    : items;
  const sortedItems = [...filteredItems].sort((a, b) => {
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
          <label htmlFor={`${formId}-project`} className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">Project name *</label>
          <input id={`${formId}-project`} type="text" value={formData.project || ""} onChange={(e) => set("project", e.target.value)} placeholder="Project name" required className={inputClass} />
        </div>
        {aiDraftReady && <p role="status" className="text-sm text-neutral-600 dark:text-neutral-300">Suggestions are ready under More details. Review them before saving.</p>}
        <details open={aiDraftReady || undefined} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700"><summary className="cursor-pointer py-1 text-sm font-medium">More details</summary><div className="mt-4 flex flex-col gap-3">
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
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">DIY cost recovery</label>
            <input type="text" value={formData.diyRoi ? `${formData.diyRoi}%` : ""} readOnly className={`${inputClass} bg-neutral-50 dark:bg-neutral-850 text-neutral-400`} />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Hired cost recovery</label>
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
          <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Tags</label>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {(formData.tags ? formData.tags.split(",").filter(Boolean) : []).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium">
                {tag}
                <button type="button" onClick={() => set("tags", (formData.tags || "").split(",").filter((t) => t !== tag).join(","))} className="hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Type tag and press Enter..."
            className={inputClass}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const val = (e.target as HTMLInputElement).value.trim().replace(/,/g, "");
                if (val) {
                  const existing = formData.tags ? formData.tags.split(",").filter(Boolean) : [];
                  if (!existing.includes(val)) set("tags", [...existing, val].join(","));
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">Notes</label>
          <textarea value={formData.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Contractor quotes, links, ideas..." className={inputClass} />
        </div>
        </div></details>
        <button
          onClick={onSubmit}
          disabled={saving || plannerBusy || !formData.project?.trim()}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-blue-700 active:scale-[0.99] transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : plannerBusy ? "Preparing suggestions…" : submitLabel}
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
              <h1 className="text-xl font-bold font-display text-neutral-950 dark:text-neutral-50">Edit Project</h1>
            </div>
          </div>
          {error && <div role="alert" className="mx-5 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-sm text-red-600">{error}</div>}
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
              <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">
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
                  tags: selectedItem.tags.join(","),
                  notes: selectedItem.notes || "",
                });
                setAiDraftReady(false);
                setEditing(true);
              }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </div>
          )}
        </div>

        {error && <div role="alert" className="mx-5 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-sm text-red-600">{error}</div>}

        <div className="flex flex-col gap-4 mx-5">
          {selectedItem.photos.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm overflow-hidden">
              {selectedItem.photos.length === 1 ? (
                <button type="button" onClick={() => openLightbox(selectedItem.photos)} className="relative block h-64 w-full" aria-label={`View photo of ${selectedItem.project}`}><TaskImage src={selectedItem.photos[0]} alt={selectedItem.project} fill sizes="(max-width: 768px) 100vw, 640px" className="object-contain" /></button>
              ) : (
                <div className="flex gap-1 overflow-x-auto snap-x snap-mandatory">
                  {selectedItem.photos.map((url, i) => (
                    <button key={url} type="button" onClick={() => openLightbox(selectedItem.photos, i)} className="relative h-64 w-full shrink-0 snap-center" aria-label={`View photo ${i + 1} of ${selectedItem.project}`}><TaskImage src={url} alt={`${selectedItem.project} ${i + 1}`} fill sizes="(max-width: 768px) 100vw, 640px" className="object-contain" /></button>
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
                <button key={mode} onClick={() => changeCostMode(selectedItem, mode)} disabled={saving} aria-pressed={selectedItem.costMode === mode}
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
                  <button
                    onClick={() => handleAiCostEstimate(selectedItem)}
                    disabled={estimatingCost}
                    className="mx-auto mt-1 flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 disabled:opacity-50"
                  >
                    {estimatingCost ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI estimate
                  </button>
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
                  <button
                    onClick={() => handleAiCostEstimate(selectedItem)}
                    disabled={estimatingCost}
                    className="mx-auto mt-1 flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 disabled:opacity-50"
                  >
                    {estimatingCost ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI estimate
                  </button>
                )}
              </div>
            </div>

            {/* Value Add + Savings */}
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Estimated resale value added</p>
              <p className="text-lg font-bold text-emerald-600">
                {selectedItem.valueAdd != null ? `$${selectedItem.valueAdd.toLocaleString()}` : "—"}
              </p>
              {selectedItem.diyCost != null && selectedItem.hiredCost != null && selectedItem.hiredCost > selectedItem.diyCost && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  Estimated savings: ${(selectedItem.hiredCost - selectedItem.diyCost).toLocaleString()} doing it yourself ({Math.round(((selectedItem.hiredCost - selectedItem.diyCost) / selectedItem.hiredCost) * 100)}% less)
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
                {selectedItem.promotedTaskId ? <Link href={`/task/${selectedItem.promotedTaskId}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Open linked task</Link> : <button onClick={() => handleAction(selectedItem.id, "restore")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30 active:scale-[0.98] transition-all">
                  <ArchiveRestore className="w-4 h-4" /> Restore
                </button>}
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
                {/* Move to Tasks */}
                {!promoting ? (
                  <button onClick={() => { setPromoting(true); setPromoteDate(""); setPromoteEndDate(""); }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all">
                    <Rocket className="w-4 h-4" /> Move to Tasks
                  </button>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-4 flex flex-col gap-3 border border-emerald-200 dark:border-emerald-900">
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4" /> Move this idea to your tasks
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">The idea will be archived and linked to its task. Its estimate remains a planning amount.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">Plan for (optional)</label>
                        <input aria-label="Plan for (optional)" type="date" value={promoteDate} onChange={(e) => setPromoteDate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">End Date</label>
                        <input aria-label="End date (optional)" type="date" disabled={!promoteDate} value={promoteEndDate} onChange={(e) => setPromoteEndDate(e.target.value)} min={promoteDate}
                          className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setPromoting(false)}
                        className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.98] transition-all">
                        Cancel
                      </button>
                      <button onClick={() => handlePromote(selectedItem)} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CalendarPlus className="w-4 h-4" /> Move to Tasks</>}
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
            <h1 className="text-2xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Wish List</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowForm(!showForm); setFormData({}); setAiDraftReady(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all">
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? "Cancel" : "Add"}
            </button>
            <PageMenu />
          </div>
        </div>
        <p className="text-sm text-neutral-400 mt-0.5 ml-12">Ideas for your home. No commitment required.</p>
      </div>

      {error && <div role="alert" className="mx-5 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-sm text-red-600">{error}</div>}

      {/* Add form */}
      {showForm && (
        <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          {renderForm("Save idea", handleSave)}
          <details><summary className="cursor-pointer py-2 text-sm font-medium">Get help planning this idea</summary><div className="mt-3"><ProjectPlanner onPlanned={handlePlanned} onBusyChange={setPlannerBusy} /></div></details>
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
                const remaining = new Set(selectedIds);
                for (const id of selectedIds) {
                  if (await handleAction(id, "archive")) remaining.delete(id);
                  else break;
                }
                setSelectedIds(remaining);
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
      {!loading && items.length > 0 && <details className="mx-5 rounded-2xl bg-white p-4 dark:bg-neutral-900"><summary className="cursor-pointer py-2 text-sm font-semibold">Compare idea estimates</summary><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Optional ideas are separate from spending. Selecting ideas here only compares them.</p><CostSummary items={items} selectedIds={selectedIds} /></details>}

      {/* Search */}
      {!showForm && !loading && items.length > 0 && (
        <div className="px-5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects or tags..."
            className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
          />
        </div>
      )}

      {/* Sort + Archive toggle */}
      {!showForm && !loading && (
        <div className="px-5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
            {(["cost", "roi", "priority"] as SortKey[]).map((key) => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${sortBy === key ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "text-neutral-400 hover:text-neutral-600"}`}>
                {key === "cost" ? "Cost" : key === "roi" ? "Recovery" : "Priority"}
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
          <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{showArchived ? "No saved ideas yet" : "No active ideas"}</p>
          <p className="text-sm text-neutral-400 mt-1">Tap Add to save an idea whenever one comes to mind.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          {sortedItems.length === 0 && <p className="py-8 text-center text-sm text-neutral-600 dark:text-neutral-400">No ideas match your search. Try another word.</p>}
          {sortedItems.map((item) => {
            const isArchived = item._status === "Archived";
            const isSelected = selectedIds.has(item.id);
            return (
              <div key={item.id} className={`bg-white dark:bg-neutral-900 rounded-2xl shadow-sm overflow-hidden transition-all ${isArchived ? "opacity-50" : ""}`}>
                {item.photos.length > 0 && (
                  <button onClick={() => setSelectedItem(item)} aria-label={`Open ${item.project}`} className="relative block h-32 w-full"><TaskImage src={item.photos[0]} alt={item.project} fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" /></button>
                )}
                <div className="flex items-start gap-3 p-4">
                  {/* Checkbox */}
                  <button onClick={() => toggleSelect(item.id)} aria-label={`Compare ${item.project}`} aria-pressed={isSelected}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-neutral-300 dark:border-neutral-600"}`}>
                    {isSelected && <span className="text-xs font-bold">✓</span>}
                  </button>

                  {/* Content */}
                  <button onClick={() => setSelectedItem(item)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-[15px] font-semibold text-neutral-950 dark:text-neutral-50">{item.project}</h3>
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
                      {item.tags.map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">{tag}</span>
                      ))}
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
