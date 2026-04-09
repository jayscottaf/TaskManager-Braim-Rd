"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { FieldDefinition } from "@/lib/feature-templates";

interface DynamicFormProps {
  schema: FieldDefinition[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
  initialValues?: Record<string, string>;
  submitLabel?: string;
}

export function DynamicForm({ schema, onSubmit, initialValues, submitLabel = "Save Entry" }: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const prevInitial = useRef(initialValues);

  // Merge in new initialValues when they change (e.g. from a scan)
  useEffect(() => {
    if (initialValues && initialValues !== prevInitial.current) {
      prevInitial.current = initialValues;
      setValues((prev) => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  function set(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values[schema[0].name]?.trim()) return;
    setSaving(true);
    try {
      await onSubmit(values);
      setValues({});
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {schema.map((field, i) => (
        <div key={field.name}>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1.5">
            {field.name} {i === 0 && "*"}
          </label>

          {field.type === "select" ? (
            <select
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
              type="date"
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className={`${inputClass} cursor-pointer`}
            />
          ) : field.type === "url" ? (
            <input
              type="url"
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              placeholder={field.placeholder || "https://..."}
              className={inputClass}
            />
          ) : field.type === "textarea" ? (
            <textarea
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              placeholder={field.placeholder || ""}
              rows={4}
              className={`${inputClass} font-mono text-xs leading-relaxed resize-y`}
            />
          ) : field.type === "number" ? (
            <input
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
              type="text"
              value={values[field.name] || ""}
              onChange={(e) => set(field.name, e.target.value)}
              placeholder={field.placeholder || ""}
              required={i === 0}
              className={inputClass}
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={saving || !values[schema[0].name]?.trim()}
        className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-blue-700 active:scale-[0.99] transition-all"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : submitLabel}
      </button>
    </form>
  );
}
