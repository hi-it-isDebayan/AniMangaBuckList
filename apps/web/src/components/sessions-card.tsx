"use client";

import { useState, useTransition } from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/actions/settings";
import { Button } from "@/components/ui/button";

export interface SessionRow {
  id: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

function DeviceIcon({ label }: { label: string | null }) {
  const text = (label ?? "").toLowerCase();
  if (text.includes("tablet")) return <Tablet className="h-4 w-4 shrink-0 text-primary" />;
  if (text.includes("phone")) return <Smartphone className="h-4 w-4 shrink-0 text-primary" />;
  return <Monitor className="h-4 w-4 shrink-0 text-primary" />;
}

export function SessionsCard({
  sessions,
  currentSessionId,
}: {
  sessions: SessionRow[];
  currentSessionId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  function revoke(sessionId: string) {
    setMessage(null);
    startTransition(async () => {
      const result: { ok: boolean; error?: string } = await revokeSessionAction({ sessionId });
      if (!result?.ok) {
        setMessage({ kind: "err", text: result?.error ?? "Could not sign out that device." });
      }
    });
  }

  function revokeOthers() {
    setMessage(null);
    startTransition(async () => {
      await revokeOtherSessionsAction();
    });
  }

  return (
    <div className="space-y-3">
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <DeviceIcon label={s.deviceLabel} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.deviceLabel || "Unknown device"}
                      {isCurrent && <span className="ml-1.5 text-xs text-primary">· this device</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Last seen {new Date(s.lastSeenAt).toLocaleString()}
                      {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                    </p>
                  </div>
                </div>
                {!isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => revoke(s.id)}
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sessions.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={revokeOthers}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Sign out other devices
        </Button>
      )}

      {message && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message.text}
        </p>
      )}
    </div>
  );
}