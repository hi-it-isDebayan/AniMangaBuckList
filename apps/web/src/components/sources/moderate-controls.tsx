"use client";

import { useActionState, useState } from "react";
import { moderateSourceAction, type ActionResult } from "@/actions/sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const empty: ActionResult = {};

/**
 * Moderator controls on the health & reports view. The action is carried by the
 * submit button, and the destructive DELETE action needs a second confirming
 * click. Authorization is enforced again server-side.
 */
export function ModerateControls({
  sourceId,
  hidden,
}: {
  sourceId: string;
  hidden: boolean;
}) {
  const [state, formAction, pending] = useActionState(moderateSourceAction, empty);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="sourceId" value={sourceId} />
      <Input name="reason" placeholder="Reason (shown in the audit log)" autoComplete="off" maxLength={300} />
      <div className="flex flex-wrap gap-2">
        {hidden ? (
          <Button type="submit" name="action" value="RESTORE" size="sm" variant="outline" disabled={pending}>
            Restore
          </Button>
        ) : (
          <Button type="submit" name="action" value="DEPRECATE" size="sm" variant="outline" disabled={pending}>
            Deprecate (hide)
          </Button>
        )}
        <Button
          type="submit"
          name="action"
          value="DELETE"
          size="sm"
          variant="ghost"
          disabled={pending}
          className={confirmingDelete ? "text-destructive hover:text-destructive" : undefined}
          onClick={(event) => {
            if (!confirmingDelete) {
              event.preventDefault();
              setConfirmingDelete(true);
            }
          }}
        >
          {confirmingDelete ? "Confirm delete?" : "Delete globally"}
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-300">{state.message}</p>
      ) : null}
    </form>
  );
}
