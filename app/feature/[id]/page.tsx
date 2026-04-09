"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Loader2, Pencil, ChevronRight, Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { getTemplate } from "@/lib/feature-templates";
import { getInstalledFeature, saveInstalledFeature } from "@/lib/feature-store";
import { DynamicForm } from "@/components/dynamic-form";
import { PaintScanner } from "@/components/paint-scanner";

// Fields that should never be truncated (shown in full, with whitespace preserved)
const FULL_DISPLAY_FIELDS = new Set(["Colorant Formula"]);

export default function FeaturePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const template = getTemplate(id);
  const [dbId, setDbId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [scanData, setScanData] = useState<Record<string, string> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedItem, setSelectedItem] = useState<Record<string, any> | null>(null);
  const [editing, setEditing] = useState(false);

  const loadItems = useCallback(async (databaseId: string) => {
    setLoading(true);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch(`/api/features/${id}/items?dbId=${databaseId}`, {
        headers: secret ? { "x-app-secret": secret } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    async function resolveAndLoad() {
      try {
        const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
        const res = await fetch(`/api/features/resolve?featureId=${id}`, {
          headers: secret ? { "x-app-secret": secret } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.installed && data.databaseId) {
            saveInstalledFeature(id, data.databaseId);
            setDbId(data.databaseId);
            loadItems(data.databaseId);
            return;
          }
        }
      } catch {
        // Fall through to localStorage
      }

      const installed = getInstalledFeature(id);
      if (!installed) {
        router.push("/store");
        return;
      }
      setDbId(installed.databaseId);
      loadItems(installed.databaseId);
    }
    resolveAndLoad();
  }, [id, router, loadItems]);

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500">Feature not found</p>
      </div>
    );
  }

  async function handleAdd(data: Record<string, string>) {
    if (!dbId) return;
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch(`/api/features/${id}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({ dbId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setShowForm(false);
      setScanData(undefined);
      loadItems(dbId);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleEdit(data: Record<string, string>) {
    if (!dbId || !selectedItem) return;
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch(`/api/features/${id}/items`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({ pageId: selectedItem.id, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setEditing(false);
      setSelectedItem(null);
      loadItems(dbId);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(pageId: string) {
    if (!dbId) return;
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch(`/api/features/${id}/items`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({ pageId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setSelectedItem(null);
      loadItems(dbId);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  const titleField = template.schema[0].name;

  function formatValue(fieldName: string, fieldType: string, val: unknown): string {
    if (val === null || val === undefined || val === "") return "";
    if (fieldType === "number" && (fieldName.toLowerCase().includes("price") || fieldName.toLowerCase().includes("cost") || fieldName.toLowerCase().includes("value"))) {
      return `$${Number(val).toLocaleString()}`;
    }
    return String(val);
  }

  // Detail/edit overlay
  if (selectedItem && template) {
    const editInitial: Record<string, string> = {};
    for (const field of template.schema) {
      const v = selectedItem[field.name];
      if (v !== null && v !== undefined) editInitial[field.name] = String(v);
    }

    return (
      <div className="flex flex-col gap-5 pt-6 pb-24 animate-fade-in">
        {/* Header */}
        <div className="px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelectedItem(null); setEditing(false); }}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
                {selectedItem[titleField] || "Untitled"}
              </h1>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              {editing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {editing ? (
          <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
            <DynamicForm
              schema={template.schema}
              onSubmit={handleEdit}
              initialValues={editInitial}
              submitLabel="Save Changes"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 mx-5">
            {selectedItem["Photo"] && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedItem["Photo"]}
                  alt={selectedItem[titleField] || "Photo"}
                  className="w-full object-contain max-h-72"
                />
              </div>
            )}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
              {template.schema.slice(1).map((field) => {
                if (field.name === "Photo") return null;
                const val = selectedItem[field.name];
                const display = formatValue(field.name, field.type, val);
                if (!display) return null;
                const isFull = FULL_DISPLAY_FIELDS.has(field.name);
                return (
                  <div key={field.name}>
                    <span className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">
                      {field.name}
                    </span>
                    <p className={`text-sm text-neutral-800 dark:text-neutral-200 mt-0.5 ${isFull ? "whitespace-pre-wrap font-mono text-xs leading-relaxed bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3" : ""}`}>
                      {display}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Archive / Delete */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  if (confirm("Delete this entry? It will be moved to Notion's trash (recoverable for 30 days).")) {
                    handleDelete(selectedItem.id);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.98] transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/store"
              className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              {template.name}
            </h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add"}
          </button>
        </div>
        <p className="text-sm text-neutral-400 mt-0.5 ml-12">{template.description}</p>
      </div>

      {error && (
        <div className="mx-5 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          {id === "paint-tracker" && (
            <PaintScanner
              onScanned={(data) => {
                setScanData(data);
              }}
            />
          )}
          <DynamicForm schema={template.schema} onSubmit={handleAdd} initialValues={scanData} />
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">No entries yet</p>
          <p className="text-sm text-neutral-400 mt-1">Tap Add to create your first entry</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md active:scale-[0.99] text-left w-full"
            >
              {item["Photo"] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item["Photo"]}
                  alt={item[titleField] || "Photo"}
                  className="w-full h-36 object-cover"
                />
              )}
              <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[15px] font-semibold text-neutral-950 dark:text-neutral-50">
                  {item[titleField] || "Untitled"}
                </h3>
                <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {template.schema.slice(1).map((field) => {
                  const val = item[field.name];
                  if (field.name === "Photo") return null;
                  const display = formatValue(field.name, field.type, val);
                  if (!display) return null;
                  // Show preview (truncated) on cards — full view is in detail
                  return (
                    <div key={field.name} className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">
                        {field.name}
                      </span>
                      <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                        {display}
                      </span>
                    </div>
                  );
                })}
              </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
