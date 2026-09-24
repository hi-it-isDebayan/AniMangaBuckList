import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <PageLink
        href={buildHref(Math.max(1, page - 1))}
        disabled={page <= 1}
        label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </PageLink>
      {pages.map((p) => (
        <PageLink
          key={p}
          href={buildHref(p)}
          current={p === page}
          label={`Page ${p}`}
        >
          {p}
        </PageLink>
      ))}
      <PageLink
        href={buildHref(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  current,
  label,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors",
    current
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) {
    return (
      <span className={className} aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} aria-label={label} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}