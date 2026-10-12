"use client";

import { ReactNode } from "react";

/**
 * Deprecated passthrough.
 *
 * Search state is provided once by `SearchLayout` (wrapping the whole app,
 * including the global `CommandSearch`) and is keyed to the active route so
 * each tab keeps its own independent search state. Pages used to nest their
 * own provider here, which meant their `defaultType`/`defaultSource` never
 * reached the real search bar. Kept as a no-op so page markup stays stable.
 */
export function SearchProviderWrapper({
  children,
}: {
  children: ReactNode;
  defaultType?: "ANIME" | "MANGA";
  defaultSource?: "all" | "mal" | "mangabaka" | "anilist";
}) {
  return <>{children}</>;
}
