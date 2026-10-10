"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const initialState: AuthState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthState, formData: FormData) => requestPasswordResetAction(formData),
    initialState,
  );

  if (state?.success) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a single-use reset link (valid for 15 minutes) is
          on its way.
        </p>
        {state.debugLink && (
          <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Dev link: <a href={state.debugLink} className="text-primary underline">{state.debugLink}</a>
          </p>
        )}
        <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}