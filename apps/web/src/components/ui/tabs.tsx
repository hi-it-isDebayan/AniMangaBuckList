"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TabsItem {
  value: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabsItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [active, setActive] = useState(value);
  const current = value ?? active;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={current === item.value}
          onClick={() => {
            setActive(item.value);
            onChange(item.value);
          }}
          className={cn(
            "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            current === item.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
          {typeof item.count === "number" && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}