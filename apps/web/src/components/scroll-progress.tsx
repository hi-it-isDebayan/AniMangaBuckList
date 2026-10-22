"use client";

import { useEffect, useState } from "react";

/**
 * A thin reading-progress bar pinned to the bottom edge of the sticky header.
 * Pure CSS width driven by a scroll listener with rAF throttling.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = document.documentElement;
      const scrollable = el.scrollHeight - el.clientHeight;
      setProgress(scrollable > 0 ? Math.min(1, el.scrollTop / scrollable) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-primary via-primary/70 to-primary/40"
      style={{ transform: `scaleX(${progress})`, opacity: progress > 0.005 ? 1 : 0, transition: "opacity 200ms ease" }}
    />
  );
}
