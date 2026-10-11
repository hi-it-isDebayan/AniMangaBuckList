"use client";

import { SearchProvider } from "@/components/search-context";
import { ReactNode } from "react";

export function SearchLayout({ children }: { children: ReactNode }) {
  return <SearchProvider>{children}</SearchProvider>;
}