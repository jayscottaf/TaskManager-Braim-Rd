"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Paintbrush, Refrigerator, HardHat, ShieldCheck, Package, Key,
  Download, Check, Loader2, ExternalLink,
} from "lucide-react";
import type { FeatureTemplate } from "@/lib/feature-templates";
import { isFeatureInstalled, saveInstalledFeature } from "@/lib/feature-store";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Paintbrush, Refrigerator, HardHat, ShieldCheck, Package, Key,
};

export function FeatureCard({ template }: { template: FeatureTemplate }) {
  const router = useRouter();
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInstalled(isFeatureInstalled(template.id));
  }, [template.id]);

  const Icon = ICONS[template.icon] || Package;

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch("/api/features/install", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({ featureId: template.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Install failed");
      }

      const { databaseId } = await res.json();
      saveInstalledFeature(template.id, databaseId);
      setInstalled(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setInstalling(false);
    }
  }

  function handleOpen() {
    router.push(`/feature/${template.id}`);
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-neutral-950 dark:text-neutral-50">
              {template.name}
            </h3>
            <span className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">
              {template.category}
            </span>
          </div>
        </div>
        <span className="text-xs text-neutral-400">
          {template.popularity.toLocaleString()} installs
        </span>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
        {template.description}
      </p>

      <div className="flex flex-wrap gap-1">
        {template.schema.map((field) => (
          <span
            key={field.name}
            className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-md text-[10px] font-medium"
          >
            {field.name}
          </span>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {installed ? (
        <div className="flex gap-2">
          <button
            onClick={handleOpen}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </button>
          <span className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
            <Check className="w-3.5 h-3.5" />
            Installed
          </span>
        </div>
      ) : (
        <button
          onClick={handleInstall}
          disabled={installing}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          {installing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Install
            </>
          )}
        </button>
      )}
    </div>
  );
}
