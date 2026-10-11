"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Loader2 } from "lucide-react";
import { importFromProviderAction } from "@/actions/library";
import { Button } from "@/components/ui/button";
import { ProviderIcon } from "@/components/provider-icon";

export function ImportProviderButton({
  importable,
  total,
}: {
  importable: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (total === 0) return null;

  const run = () => {
    setResult(null);
    setError(null);
    startTransition(async () => {
      const res = await importFromProviderAction();
      if (res.ok && res.data) {
        const { imported, skipped } = res.data;
        setResult(
          imported === 1 ? "Imported 1 title" : `Imported ${imported} titles`,
        );
        if (skipped > 0) setError(`${skipped} could not be imported`);
        router.refresh();
      } else {
        setError(res.error ?? "Import failed.");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <ProviderIcon provider="mangabaka" />
        <div>
          <p className="text-sm font-medium">MangaBaka library</p>
          <p className="text-xs text-muted-foreground">
            {importable > 0
              ? `${importable} ${importable === 1 ? "title" : "titles"} ready to import into your library.`
              : "All MangaBaka titles are already in your library."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {result && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" /> {result}
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
        <Button
          type="button"
          size="sm"
          variant={importable > 0 ? "default" : "outline"}
          disabled={pending || importable === 0}
          onClick={run}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              {importable > 0 ? `Import ${importable}` : "Imported"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
