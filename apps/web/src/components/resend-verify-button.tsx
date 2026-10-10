"use client";

import { useActionState } from "react";
import { resendVerificationAction, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: AuthState = {};

export function ResendVerifyButton() {
  const [state, formAction, pending] = useActionState(resendVerificationAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      {state?.success && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
          Verification email sent. Check your inbox.
        </p>
      )}
      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Resend email"}
      </Button>
    </form>
  );
}