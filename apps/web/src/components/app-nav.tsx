"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="ml-1 flex items-center gap-1 text-sm sm:ml-4 sm:gap-1.5">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative rounded-lg px-2.5 py-1.5 font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3",
              active
                ? "text-foreground after:absolute after:inset-x-2.5 after:top-full after:-mt-px after:h-0.5 after:rounded-full after:bg-brand-gradient"
                : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}