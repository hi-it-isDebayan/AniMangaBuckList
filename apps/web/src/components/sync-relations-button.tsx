"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncRelationsAction } from "@/actions/library";
import { Button } from "@/components/ui/button";

export function SyncRelationsButton({ titleId }: { titleId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await syncRelationsAction({ titleId }).catch(() => {});
        setBusy(false);
        setDone(true);
        router.refresh();
        setTimeout(() => setDone(false), 1500);
      }}
    >
      <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
      {done ? "Synced" : busy ? "Syncing…" : "Sync relations"}
    </Button>
  );
}