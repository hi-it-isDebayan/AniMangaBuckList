"use client";

import { useRouter } from "next/navigation";
import { setFavoriteAction } from "@/actions/library";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  titleId,
  favorite,
}: {
  titleId: string;
  favorite: boolean;
}) {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        await setFavoriteAction({ titleId, favorite: !favorite });
        router.refresh();
      }}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      title={favorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={cn(
          "h-4 w-4",
          favorite && "fill-rose-500 text-rose-500",
        )}
      />
    </Button>
  );
}