"use client";

import { usePathname } from "next/navigation";
import { SearchProvider } from "@/components/search-context";
import { ReactNode } from "react";

export function SearchLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDiscover = pathname.startsWith("/discover");

  return (
    <SearchProvider
      defaultType="MANGA"
      defaultSource={isDiscover ? "mangabaka" : "all"}
      resetKey={pathname}
    >
      {children}
    </SearchProvider>
  );
}
