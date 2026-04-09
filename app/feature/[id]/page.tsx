"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { getTemplate } from "@/lib/feature-templates";
import { getInstalledFeature, saveInstalledFeature } from "@/lib/feature-store";
import { DynamicForm } from "@/components/dynamic-form";
import { PaintScanner } from "@/components/paint-scanner";

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
      // First try to resolve from Notion (server-side, cross-device)
      try {
        const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
        const res = await fetch(`/api/features/resolve?featureId=${id}`, {
          headers: secret ? { "x-app-secret": secret } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.installed && data.databaseId) {
            // Sync localStorage with the server-resolved database
            saveInstalledFeature(id, data.databaseId);
            setDbId(data.databaseId);
            loadItems(data.databaseId);
            return;
          }
        }
      } catch {
        // Fall through to localStorage
      }

      // Fallback to localStorage
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

  const titleField = template.schema[0].name;

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
            <div
              key={item.id}
              className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4 transition-all"
            >
              <h3 className="text-[15px] font-semibold text-neutral-950 dark:text-neutral-50 mb-2">
                {item[titleField] || "Untitled"}
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {template.schema.slice(1).map((field) => {
                  const val = item[field.name];
                  if (val === null || val === undefined || val === "") return null;
                  return (
                    <div key={field.name} className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">
                        {field.name}
                      </span>
                      <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                        {field.type === "number" && (field.name.toLowerCase().includes("price") || field.name.toLowerCase().includes("cost") || field.name.toLowerCase().includes("value"))
                          ? `$${Number(val).toLocaleString()}`
                          : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
