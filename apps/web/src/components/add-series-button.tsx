"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import type { MediaType } from "@ambl/types";
import { addMangabakaTitleAction } from "@/actions/library";
import { defaultStatusForType } from "@/lib/format";

export function AddSeriesButton({
  mangabakaId,
  mediaType,
}: {
  mangabakaId: number;
  mediaType: MediaType;
}) {
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const add = async () => {
    setPending(true);
    setError(null);
    const res = await addMangabakaTitleAction({
      mangabakaId,
      status: defaultStatusForType(mediaType),
    });
    setPending(false);
    if (res.ok) {
      setAdded(true);
      router.refresh();
    } else {
      setError(res.error ?? "Could not add this title.");
    }
  };

  if (added) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-600 dark:text-emerald-300">
        <Check className="h-3.5 w-3.5" /> In library
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void add()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {pending ? "Adding…" : "Add to library"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
