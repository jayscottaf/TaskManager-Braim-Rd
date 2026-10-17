"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { House, ClipboardList, Plus, DollarSign, Ellipsis, Calendar, Heart, Archive, Wrench, CheckCircle, Printer, Sparkles, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useModalFocus } from "@/components/use-modal-focus";

const MORE_LINKS = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/wishlist", label: "Wish list", icon: Heart },
  { href: "/store", label: "Home records", icon: Archive },
  { href: "/contractors", label: "Contractors", icon: Wrench },
  { href: "/done", label: "Completed work", icon: CheckCircle },
  { href: "/checklist", label: "Print checklist", icon: Printer },
];

export function BottomNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const allTasksView = ["list", "q", "status", "priority", "area", "range", "tag", "workMode", "view"].some((key) => Boolean(params.get(key)));
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useModalFocus(open, panel, close);
  const current = `${pathname}${params.size ? `?${params.toString()}` : ""}`;
  const items = [
    { href: "/", label: "Your plan", icon: House, active: pathname === "/" && !allTasksView },
    { href: "/?list=all", label: "Tasks", icon: ClipboardList, active: pathname === "/" && allTasksView },
    { href: pathname === "/add" ? "/add" : `/add?returnTo=${encodeURIComponent(current)}`, label: "Add task", icon: Plus, active: pathname === "/add" },
    { href: "/spending", label: "Costs", icon: DollarSign, active: pathname === "/spending" },
  ];
  return (
    <>
      <nav aria-label="Main navigation" className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-surface/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-16 max-w-lg items-center px-2">
          {items.map(({ href, label, icon: Icon, active }) => (
            <Link key={label} href={href} onClick={close} aria-label={label} aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}>
              {label === "Add task" ? <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-on-accent"><Icon className="h-6 w-6" /></span> : <><Icon className="h-5 w-5" /><span>{label}</span></>}
            </Link>
          ))}
          <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${open || MORE_LINKS.some((link) => pathname.startsWith(link.href)) ? "text-accent" : "text-muted"}`}>
            <Ellipsis className="h-5 w-5" /><span>More</span>
          </button>
        </div>
      </nav>
      {open && <div className="fixed inset-0 z-[70] flex items-end bg-black/50" onClick={close}>
        <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="more-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}
          className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="mb-3 flex items-center justify-between"><h2 id="more-title" className="text-lg font-semibold">Around your home</h2><button type="button" onClick={close} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted"><X className="h-5 w-5" /></button></div>
          {MORE_LINKS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={close} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"><Icon className="h-5 w-5 text-muted" />{label}</Link>)}
          <button type="button" onClick={() => { close(); window.dispatchEvent(new CustomEvent("open-ai")); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"><Sparkles className="h-5 w-5 text-muted" />Maintenance ideas</button>
          <div className="mt-3 flex items-center justify-between border-t border-line px-3 pt-3"><span className="text-sm text-muted">Appearance</span><ThemeToggle /></div>
        </div>
      </div>}
    </>
  );
}
