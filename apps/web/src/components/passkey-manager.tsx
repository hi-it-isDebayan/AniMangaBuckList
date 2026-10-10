"use client";

import { useState, useTransition } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, ShieldCheck, Trash2 } from "lucide-react";
import { deletePasskeyAction } from "@/actions/webauthn";
import { Button } from "@/components/ui/button";

export interface PasskeyRow {
  id: string;
  credentialId: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Status {
  kind: "ok" | "err" | "info";
  text: string;
}

export function PasskeyManager({ credentials }: { credentials: PasskeyRow[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState(false);

  async function register() {
    setStatus(null);
    try {
      const res = await fetch("/api/auth/passkey/register/options", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.options) throw new Error(data?.error ?? "Could not start registration.");
      const attResp = await startRegistration(data.options);
      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverChallenge: data.options.challenge, ...attResp }),
      });
      const vData = await verifyRes.json();
      if (!verifyRes.ok || !vData?.ok) throw new Error(vData?.error ?? "Registration failed.");
      setStatus({ kind: "ok", text: "Passkey added. You can now sign in with it." });
      location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setStatus({ kind: "err", text: message });
    }
  }

  function remove(credentialId: string) {
    setRemoving(true);
    startTransition(async () => {
      const result = await deletePasskeyAction({ credentialId });
      setRemoving(false);
      if (!result?.ok) {
        setStatus({ kind: "err", text: result?.error ?? "Could not remove passkey." });
        return;
      }
      location.reload();
    });
  }

  return (
    <div className="space-y-3">
      {credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No passkeys yet. Add one to sign in with your fingerprint or face on any device.
        </p>
      ) : (
        <ul className="space-y-2">
          {credentials.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Fingerprint className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name || "Passkey"}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(c.createdAt).toLocaleDateString()}
                    {c.lastUsedAt ? ` · last used ${new Date(c.lastUsedAt).toLocaleDateString()}` : " · never used"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={removing}
                onClick={() => remove(c.credentialId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {status && (
        <p
          className={
            status.kind === "err"
              ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              : "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300"
          }
        >
          {status.text}
        </p>
      )}

      <Button variant="outline" size="sm" disabled={pending} onClick={register}>
        <ShieldCheck className="h-3.5 w-3.5" /> Add passkey
      </Button>
    </div>
  );
}