"use client";

import { useActionState } from "react";
import { resolveReportAction, type ActionResult } from "@/actions/sources";
import { Button } from "@/components/ui/button";

const empty: ActionResult = {};

export function ResolveReportButton({ reportId }: { reportId: string }) {
  const [state, formAction, pending] = useActionState(resolveReportAction, empty);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Resolving…" : "Resolve"}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
