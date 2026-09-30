"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { HomeIcon, ContentIcon, CalendarIcon, ChartIcon, SettingsIcon } from "./Icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/content", label: "Konten", Icon: ContentIcon },
  { href: "/schedule", label: "Jadwal", Icon: CalendarIcon },
  { href: "/analytics", label: "Analitik", Icon: ChartIcon },
  { href: "/settings", label: "Setelan", Icon: SettingsIcon },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface shadow-[0_0_0_1px_rgba(180,83,9,0.08)] sm:my-0">
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-amber-100 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${
                    active ? "text-primary" : "text-stone-500"
                  }`}
                >
                  <span className={`rounded-full px-4 py-1 transition ${active ? "bg-amber-100" : ""}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
