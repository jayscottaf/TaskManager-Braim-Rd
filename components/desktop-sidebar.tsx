"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { House, ClipboardList, Calendar, Plus, Heart, Sparkles, Archive, DollarSign, Wrench, CheckCircle, Printer } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const PRIMARY = [
  { href: "/", label: "Your plan", icon: House },
  { href: "/?list=all", label: "All tasks", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/spending", label: "Costs", icon: DollarSign },
];
const SECONDARY = [
  { href: "/wishlist", label: "Wish list", icon: Heart },
  { href: "/store", label: "Home records", icon: Archive },
  { href: "/contractors", label: "Contractors", icon: Wrench },
  { href: "/done", label: "Completed work", icon: CheckCircle },
  { href: "/checklist", label: "Print checklist", icon: Printer },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const allTasksView = ["list", "q", "status", "priority", "area", "range", "tag", "workMode", "view"].some((key) => Boolean(params.get(key)));
  function active(href: string) {
    if (href === "/") return pathname === "/" && !allTasksView;
    if (href === "/?list=all") return pathname === "/" && allTasksView;
    return pathname.startsWith(href);
  }
  return <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-56 flex-col border-r border-line bg-surface lg:flex">
    <Link href="/" className="px-5 pb-6 pt-8"><span className="font-display text-2xl font-bold tracking-tight">Braim Rd</span><span className="mt-1 block text-xs text-muted">A little care, at your pace</span></Link>
    <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3">
      <Link href="/add" className="mb-5 flex min-h-11 items-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-on-accent"><Plus className="h-4 w-4" />Add task</Link>
      {PRIMARY.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${active(href) ? "bg-blue-50 text-accent font-semibold" : "text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}><Icon className="h-4 w-4" />{label}</Link>)}
      <p className="mb-2 mt-7 px-3 text-xs font-medium text-muted">Your home</p>
      {SECONDARY.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${active(href) ? "bg-blue-50 text-accent font-semibold" : "text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}><Icon className="h-4 w-4" />{label}</Link>)}
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-ai"))} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800"><Sparkles className="h-4 w-4" />Maintenance ideas</button>
    </nav>
    <div className="flex items-center justify-between border-t border-line px-5 py-4"><span className="text-xs text-muted">Appearance</span><ThemeToggle /></div>
  </aside>;
}
