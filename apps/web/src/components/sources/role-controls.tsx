"use client";

import { useActionState } from "react";
import { setUserRoleAction, type ActionResult } from "@/actions/sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const empty: ActionResult = {};

export function RoleControls({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string;
  currentRole: string;
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(setUserRoleAction, empty);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        disabled={isSelf || pending}
        title={isSelf ? "You cannot change your own role." : undefined}
        className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50"
      >
        <option value="USER">User</option>
        <option value="MODERATOR">Moderator</option>
        <option value="ADMIN">Admin</option>
      </select>
      <Input
        name="reason"
        placeholder="Reason (audit log)"
        autoComplete="off"
        maxLength={300}
        className="h-9 w-48"
      />
      <Button type="submit" size="sm" variant="outline" disabled={isSelf || pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state.message ? (
        <span className="text-xs text-emerald-600 dark:text-emerald-300">{state.message}</span>
      ) : null}
    </form>
  );
}
