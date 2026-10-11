"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SegmentedTabItem {
  key: string;
  label: string;
  href: string;
  count?: number;
  icon?: ReactNode;
}

export function SegmentedTabs({
  items,
  active,
  className,
  variant = "default",
}: {
  items: SegmentedTabItem[];
  active: string;
  className?: string;
  variant?: "default" | "brand";
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border bg-muted/50 p-1 shadow-inner",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            scroll={false}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
              isActive
                ? variant === "brand"
                  ? "bg-brand-gradient text-white shadow-sm"
                  : "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? variant === "brand"
                      ? "bg-white/25 text-white"
                      : "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
