"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { rateTitleAction } from "@/actions/library";
import { cn } from "@/lib/utils";

export function RatingControl({
  titleId,
  initial,
}: {
  titleId: string;
  initial: number | null;
}) {
  const [rating, setRating] = useState(initial);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const set = async (score: number) => {
    if (score === rating && rating !== null) return;
    setPending(true);
    const res = await rateTitleAction({ titleId, score });
    setPending(false);
    if (res.ok) {
      setRating(score);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
        <button
          key={score}
          type="button"
          disabled={pending}
          onClick={() => void set(score)}
          aria-label={`Rate ${score}`}
          className="transition-transform hover:scale-110 disabled:opacity-50"
        >
          <Star
            className={cn(
              "h-4 w-4",
              rating !== null && score <= rating
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground",
            )}
          />
        </button>
      ))}
      {rating != null && (
        <span className="ml-2 text-sm text-muted-foreground">
          {rating}/10
        </span>
      )}
    </div>
  );
}