"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Calendar, Plus, Sparkles } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Tasks", icon: ClipboardList, accent: false },
  { href: "/calendar", label: "Calendar", icon: Calendar, accent: false },
  { href: "/add", label: "Add", icon: Plus, accent: true },
  { href: "#ai", label: "AI", icon: Sparkles, accent: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, accent }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          if (accent) {
            return (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-900 text-white shadow-lg -mt-4 active:scale-95 transition-transform"
              >
                <Icon className="w-6 h-6" />
              </Link>
            );
          }

          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-col items-center gap-0.5 min-w-[64px] py-1 ${
                isActive ? "text-gray-900" : "text-gray-400"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
