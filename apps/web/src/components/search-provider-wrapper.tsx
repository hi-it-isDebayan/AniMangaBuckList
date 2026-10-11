"use client";

import { SearchProvider } from "@/components/search-context";
import { ReactNode } from "react";

interface SearchProviderWrapperProps {
  children: ReactNode;
  defaultType?: "ANIME" | "MANGA";
  defaultSource?: "all" | "mal" | "mangabaka" | "anilist";
}

export function SearchProviderWrapper({
  children,
  defaultType = "MANGA",
  defaultSource = "all",
}: SearchProviderWrapperProps) {
  return (
    <SearchProvider defaultType={defaultType} defaultSource={defaultSource}>
      {children}
    </SearchProvider>
  );
}