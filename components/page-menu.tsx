"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MoreVertical, Printer, CheckCircle, DollarSign, Wrench } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const MENU_ITEMS = [
  { href: "/checklist", label: "Checklist", icon: Printer },
  { href: "/done", label: "Done", icon: CheckCircle },
  { href: "/spending", label: "Spending", icon: DollarSign },
  { href: "/contractors", label: "Contractors", icon: Wrench },
] as const;

export function PageMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Menu"
        className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 w-52 bg-white dark:bg-neutral-900 rounded-xl shadow-lg dark:shadow-neutral-950/50 border border-neutral-200 dark:border-neutral-800 py-1 z-40 animate-slide-in"
        >
          {MENU_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800 focus-visible:outline-none"
            >
              <Icon className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
              {label}
            </Link>
          ))}
          <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-neutral-700 dark:text-neutral-200">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
