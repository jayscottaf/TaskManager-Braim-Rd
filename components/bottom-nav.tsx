"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Calendar, Plus, Heart, Sparkles, Store } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Tasks", icon: ClipboardList, accent: false, action: null },
  { href: "/calendar", label: "Calendar", icon: Calendar, accent: false, action: null },
  { href: "/add", label: "Add", icon: Plus, accent: true, action: null },
  { href: "/wishlist", label: "Wish List", icon: Heart, accent: false, action: null },
  { href: "#", label: "AI", icon: Sparkles, accent: false, action: "open-ai" },
  { href: "/store", label: "Store", icon: Store, accent: false, action: null },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg shadow-[0_-1px_3px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)] z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, accent, action }) => {
          const isActive = !action && (href === "/" ? pathname === "/" : pathname.startsWith(href));

          if (accent) {
            return (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 -mt-4 active:scale-95 transition-transform"
              >
                <Icon className="w-6 h-6" />
              </Link>
            );
          }

          if (action) {
            return (
              <button
                key={label}
                onClick={() => window.dispatchEvent(new CustomEvent(action))}
                className="flex flex-col items-center gap-0.5 min-w-[64px] py-1 transition-colors text-neutral-400 hover:text-blue-600"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          }

          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-col items-center gap-0.5 min-w-[64px] py-1 transition-colors ${
                isActive ? "text-blue-600" : "text-neutral-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
