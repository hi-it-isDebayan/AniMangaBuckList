"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";

type MediaType = "ANIME" | "MANGA";
type Source = "all" | "mal" | "mangabaka" | "anilist";

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  type: MediaType;
  setType: (t: MediaType) => void;
  source: Source;
  setSource: (s: Source) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({
  children,
  defaultType = "MANGA",
  defaultSource = "all",
  resetKey,
}: {
  children: ReactNode;
  defaultType?: MediaType;
  defaultSource?: Source;
  resetKey?: string;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MediaType>(defaultType);
  const [source, setSource] = useState<Source>(defaultSource);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery("");
    setOpen(false);
    setType(defaultType);
    setSource(defaultSource);
    // Reset the search bar whenever the active tab (route) changes so each
    // tab keeps its own independent search state.
  }, [resetKey, defaultType, defaultSource]);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      type,
      setType,
      source,
      setSource,
      open,
      setOpen,
    }),
    [query, type, source, open],
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return ctx;
}