"use client";

import { useActionState, useState } from "react";
import {
  linkSourceAction,
  unlinkSourceAction,
  testSourceAction,
  reportSourceAction,
  type ActionResult,
  type ProbeActionState,
} from "@/actions/sources";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const empty: ActionResult = {};
const emptyProbe: ProbeActionState = {};

const REPORT_KINDS = [
  { value: "BROKEN", label: "Broken / unavailable" },
  { value: "SLOW", label: "Very slow" },
  { value: "WRONG_TITLE", label: "Wrong chapter or title" },
  { value: "OTHER", label: "Something else" },
];

export function SourceRowActions({ sourceId, linked }: { sourceId: string; linked: boolean }) {
  const [linkState, linkAction, linkPending] = useActionState(linkSourceAction, empty);
  const [unlinkState, unlinkAction, unlinkPending] = useActionState(unlinkSourceAction, empty);
  const [probeState, probeAction, probePending] = useActionState(testSourceAction, emptyProbe);
  const [reportState, reportAction, reportPending] = useActionState(reportSourceAction, empty);
  const [reportOpen, setReportOpen] = useState(false);

  const message = linkState.message ?? unlinkState.message ?? reportState.message;
  const error = linkState.error ?? unlinkState.error ?? reportState.error ?? probeState.error;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {linked ? (
          <form action={unlinkAction}>
            <input type="hidden" name="sourceId" value={sourceId} />
            <Button type="submit" variant="outline" size="sm" disabled={unlinkPending}>
              {unlinkPending ? "Unlinking…" : "Unlink"}
            </Button>
          </form>
        ) : (
          <form action={linkAction}>
            <input type="hidden" name="sourceId" value={sourceId} />
            <Button type="submit" size="sm" disabled={linkPending}>
              {linkPending ? "Linking…" : "Link"}
            </Button>
          </form>
        )}

        <form action={probeAction}>
          <input type="hidden" name="sourceId" value={sourceId} />
          <Button type="submit" variant="outline" size="sm" disabled={probePending}>
            {probePending ? "Testing…" : "Test"}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setReportOpen((open) => !open)}
        >
          Report
        </Button>
      </div>

      {probeState.probe ? (
        <p className="text-xs text-muted-foreground">
          <span className={probeState.probe.reachable ? "text-emerald-600 dark:text-emerald-300" : "text-destructive"}>
            {probeState.probe.reachable ? "Reachable" : "Not reachable"}
          </span>
          {" · "}
          <span className={probeState.probe.extractOk ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}>
            {probeState.probe.extractOk ? "Extractable" : "Not extractable"}
          </span>
          {" — "}
          {probeState.probe.detail}
        </p>
      ) : null}

      {reportOpen ? (
        <form action={reportAction} className="space-y-3 rounded-md border border-border p-3">
          <input type="hidden" name="sourceId" value={sourceId} />
          <div className="space-y-1.5">
            <Label htmlFor={`report-kind-${sourceId}`}>What is wrong?</Label>
            <select
              id={`report-kind-${sourceId}`}
              name="kind"
              defaultValue="BROKEN"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {REPORT_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </div>
          <Input name="note" placeholder="Optional details" autoComplete="off" maxLength={500} />
          <Button type="submit" size="sm" disabled={reportPending}>
            {reportPending ? "Sending…" : "Send report"}
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p>
      ) : null}
    </div>
  );
}
