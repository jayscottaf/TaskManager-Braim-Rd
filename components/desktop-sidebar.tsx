"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList, Calendar, Plus, Heart, Sparkles, Store,
  DollarSign, Wrench, CheckCircle, Printer,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const PRIMARY_NAV = [
  { href: "/", label: "Tasks", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/wishlist", label: "Wish List", icon: Heart },
  { href: "/store", label: "Store", icon: Store },
] as const;

const SECONDARY_NAV = [
  { href: "/spending", label: "Spending", icon: DollarSign },
  { href: "/contractors", label: "Contractors", icon: Wrench },
  { href: "/done", label: "Done", icon: CheckCircle },
  { href: "/checklist", label: "Checklist", icon: Printer },
] as const;

export function DesktopSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <aside className="hidden lg:flex flex-col w-56 h-screen fixed left-0 top-0 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 z-40">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold font-display tracking-tight text-neutral-950 dark:text-neutral-50">Braim Rd</h1>
        <p className="text-[10px] text-neutral-400 mt-0.5">Home Maintenance</p>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3">
        <Link
          href="/add"
          className="flex items-center gap-2.5 px-3 py-2.5 mb-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Link>

        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive(href)
                ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-ai"))}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          AI Suggestions
        </button>

        <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-3" />

        <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium px-3 mb-1">Insights</p>
        {SECONDARY_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive(href)
                ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-4 flex items-center justify-between">
        <span className="text-xs text-neutral-400">Theme</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
