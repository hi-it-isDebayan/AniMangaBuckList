"use client";

import { useEffect, useState } from "react";

const FALLBACK_OFFSET = 72;

export function TitleActionBar({ children }: { children: React.ReactNode }) {
  const [offset, setOffset] = useState(FALLBACK_OFFSET);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-command-search]");
    if (!el) return;

    const update = () => setOffset(el.getBoundingClientRect().height);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className="sticky z-30 mt-2 border bg-card/90 px-3 py-2.5 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 sm:rounded-xl"
      style={{ bottom: `calc(${offset}px + env(safe-area-inset-bottom))` }}
    >
      {children}
    </div>
  );
}
