"use client";

import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { FEATURE_TEMPLATES } from "@/lib/feature-templates";
import { FeatureCard } from "@/components/feature-card";

const CATEGORIES = ["All", "Tracking", "Directory", "Inventory"] as const;

export default function StorePage() {
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");

  const filtered = FEATURE_TEMPLATES
    .filter((t) => category === "All" || t.category === category)
    .filter((t) =>
      !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => b.popularity - a.popularity);

  return (
    <div className="flex flex-col gap-6 pt-6 pb-24 animate-fade-in">
      <div className="px-5">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/"
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
            Feature Store
          </h1>
        </div>
        <p className="text-sm text-neutral-400 mt-0.5 ml-12">
          Add new capabilities to your app
        </p>
      </div>

      {/* Search */}
      <div className="px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search features..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 px-5 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              category === cat
                ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 shadow-sm"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feature grid */}
      <div className="px-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((template) => (
          <FeatureCard key={template.id} template={template} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-400 text-sm">No features match your search</p>
        </div>
      )}
    </div>
  );
}
