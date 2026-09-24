"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeFromLibraryAction } from "@/actions/library";
import { Button } from "@/components/ui/button";

export function RemoveTitleButton({ titleId }: { titleId: string }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={confirming ? "text-destructive" : "text-muted-foreground"}
      onClick={async () => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        await removeFromLibraryAction({ titleId });
        router.push("/library");
      }}
    >
      {confirming ? "Confirm remove" : "Remove"}
    </Button>
  );
}