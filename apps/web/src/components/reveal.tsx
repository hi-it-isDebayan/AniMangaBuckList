"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  /** Extra classes on the wrapper. */
  className?: string;
  /** Delay in ms before the transition starts (use with reveal-stagger for a cascade). */
  delay?: number;
  as?: ElementType;
};

/**
 * Adds the `revealed` class when the element scrolls into view, which drives the
 * `.reveal` / `.reveal-stagger` CSS in globals.css. If JS or IntersectionObserver
 * is unavailable the wrapper stays visible (CSS only hides under `.js`).
 */
export function Reveal({ children, className, delay, as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", revealed && "revealed", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/** Staggered children: pass the same `reveal-stagger` class so CSS animates each child with a delay. */
export function RevealStagger({
  children,
  className,
  as: Tag = "div",
}: Omit<RevealProps, "delay">) {
  return <Reveal as={Tag} className={cn("reveal-stagger", className)}>{children}</Reveal>;
}
