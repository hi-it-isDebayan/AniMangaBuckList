"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  Compass,
  Globe,
  Home,
  LibraryBig,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Always visible as its own button. */
const HOME: NavItem = { href: "/", label: "Home", icon: Home };
/** Always visible as its own button. */
const HISTORY: NavItem = { href: "/history", label: "History", icon: Clock };
/** Collapsed into the single "Browse" dropdown. */
const BROWSE: NavItem[] = [
  { href: "/new", label: "New", icon: Sparkles },
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/sources", label: "Sources", icon: Globe },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-all sm:px-3",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{item.label}</span>
    </Link>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const browseActive = BROWSE.some((item) => isActive(pathname, item.href));
  // The dropdown shows the active member's label/icon, otherwise the first entry.
  const activeBrowse = BROWSE.find((item) => isActive(pathname, item.href)) ?? BROWSE[0]!;
  const ActiveIcon = activeBrowse.icon;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Close the menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav className="ml-1 flex items-center gap-0.5 rounded-full border bg-muted/50 p-0.5 sm:ml-4 sm:gap-1 sm:p-1">
      <NavLink item={HOME} active={isActive(pathname, HOME.href)} />

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-all sm:px-3",
            browseActive
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ActiveIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{activeBrowse.label}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-44 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg"
          >
            {BROWSE.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <NavLink item={HISTORY} active={isActive(pathname, HISTORY.href)} />
    </nav>
  );
}
