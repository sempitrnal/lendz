"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Tag, ClipboardCheck } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",       label: "Dashboard",  Icon: LayoutDashboard },
  { href: "/borrowers",       label: "Borrowers",  Icon: Users },
  { href: "/categories",      label: "Categories", Icon: Tag },
  { href: "/daily-checklist", label: "Checklist",  Icon: ClipboardCheck },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-900 bg-white shadow-[0_-2px_0_0_#0f172a] sm:hidden print:hidden">
      <ul className="flex h-[60px] items-stretch">
        {NAV_ITEMS.map(({ href, label, Icon }, i) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <li
              key={href}
              className={`flex flex-1 ${i > 0 ? "border-l border-slate-900" : ""}`}
            >
              <Link
                href={href}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[9px] font-black lowercase tracking-widest transition-colors ${
                  isActive
                    ? "bg-green-300 text-slate-900"
                    : "bg-white text-slate-400 active:bg-slate-100"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-slate-900" />
                )}
                <Icon className="size-[22px]" strokeWidth={isActive ? 2.5 : 1.75} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
