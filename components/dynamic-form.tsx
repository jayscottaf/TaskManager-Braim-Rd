"use client";

import { useState, useEffect, useRef, useId } from "react";
import { Loader2 } from "lucide-react";
import type { FieldDefinition } from "@/lib/feature-templates";

interface DynamicFormProps {
  schema: FieldDefinition[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  initialValues?: Record<string, string>;
  submitLabel?: string;
  busy?: boolean;
}

export function DynamicForm({ schema, onSubmit, initialValues, submitLabel = "Save Entry", busy = false }: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [saving, setSaving] = useState(false);
  const prevInitialRef = useRef(initialValues);
  const touched = useRef(new Set<string>());
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  // Merge in new initialValues when they change (e.g. from a scan or opening edit)
  useEffect(() => {
    if (initialValues && initialValues !== prevInitialRef.current) {
      prevInitialRef.current = initialValues;
      setValues((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(initialValues).filter(([key]) => !touched.current.has(key) && !prev[key])) }));
    }
  }, [initialValues]);

  function set(name: string, value: string) {
    touched.current.add(name);
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || saving || !values[schema[0].name]?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      setValues({});
      touched.current.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Your entries are still here.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-warning">{error}</p>}
      {schema.map((field, i) => {
        if (field.hidden) return null;
        return (
        <div key={field.name}>
          <label htmlFor={`${id}-${i}`} className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1.5">
            {field.name} {i === 0 && "*"}
          </label>

          {field.type === "select" ? (
            <select
              id={`${id}-${i}`}
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              className={inputClass}
            >
              <option value="">Select...</option>
              {field.options?.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : field.type === "date" ? (
            <input
              id={`${id}-${i}`}
              type="date"
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className={`${inputClass} cursor-pointer`}
            />
          ) : field.type === "url" ? (
            <input
              id={`${id}-${i}`}
              type="url"
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              placeholder={field.placeholder || "https://..."}
              className={inputClass}
            />
          ) : field.type === "textarea" ? (
            <textarea
              id={`${id}-${i}`}
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              placeholder={field.placeholder || ""}
              rows={4}
              className={`${inputClass} font-mono text-xs leading-relaxed resize-y`}
            />
          ) : field.type === "number" ? (
            <input
              id={`${id}-${i}`}
              type="number"
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              placeholder={field.placeholder || "0"}
              min="0"
              step="0.01"
              className={inputClass}
            />
          ) : (
            <input
              id={`${id}-${i}`}
              type="text"
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              placeholder={field.placeholder || ""}
              required={i === 0}
              className={inputClass}
            />
          )}
        </div>
        );
      })}

      <button
        type="submit"
        disabled={busy || saving || !values[schema[0].name]?.trim()}
        className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-blue-700 active:scale-[0.99] transition-all"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : busy ? "Saving photo…" : submitLabel}
      </button>
    </form>
  );
}
