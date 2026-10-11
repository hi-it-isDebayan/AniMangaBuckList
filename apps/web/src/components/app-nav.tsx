"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Home, LibraryBig } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/history", label: "History", icon: Clock },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="ml-1 flex items-center gap-0.5 rounded-full border bg-muted/50 p-0.5 sm:ml-4 sm:gap-1 sm:p-1">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-all sm:px-3",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
