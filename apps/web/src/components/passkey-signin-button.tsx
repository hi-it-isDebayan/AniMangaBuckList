"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Status {
  kind: "err" | "info";
  text: string;
}

export function PasskeySigninButton() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  async function signIn() {
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/passkey/authenticate/options", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.options) throw new Error(data?.error ?? "Could not start sign-in.");
      const authResp = await startAuthentication(data.options);
      const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverChallenge: data.options.challenge, ...authResp }),
      });
      const vData = await verifyRes.json();
      if (!verifyRes.ok || !vData?.ok) throw new Error(vData?.error ?? "Sign-in failed.");
      window.location.href = "/";
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Sign-in cancelled."
            : err.message
          : "Sign-in failed.";
      setStatus({ kind: "err", text: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={signIn}>
        <Fingerprint className="h-4 w-4" />
        {pending ? "Checking passkey…" : "Sign in with a passkey"}
      </Button>
      {status && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status.text}
        </p>
      )}
    </div>
  );
}