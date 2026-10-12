"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import type { LibraryStatus } from "@ambl/types";
import { addExistingTitleAction } from "@/actions/library";
import { Button } from "@/components/ui/button";

export function AddToLibraryButton({
  titleId,
  status,
  variant = "default",
  size = "default",
  className,
  label = "Add to library",
}: {
  titleId: string;
  status?: LibraryStatus;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const add = async () => {
    if (pending || added) return;
    setPending(true);
    setError(null);
    const res = await addExistingTitleAction({ titleId, status });
    setPending(false);
    if (res.ok) {
      setAdded(true);
      router.refresh();
    } else {
      setError(res.error ?? "Could not add this title.");
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => void add()}
        disabled={pending || added}
        aria-live="polite"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : added ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {pending ? "Adding…" : added ? "In library" : label}
      </Button>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
