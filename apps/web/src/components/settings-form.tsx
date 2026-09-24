"use client";

import { useActionState } from "react";
import { LogOut, Check } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import {
  logoutAllSessionsAction,
  updateProfileAction,
  type SettingsActionState,
} from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const initialState: SettingsActionState = {};

export function SettingsForm({
  email,
  displayName,
  notifyEpisodes,
  notifyChapters,
}: {
  email: string;
  displayName: string;
  notifyEpisodes: boolean;
  notifyChapters: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );

  return (
    <>
      <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={120}
        />
      </div>

      <fieldset className="space-y-2">
        <Legend className="mb-1">Notifications</Legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notifyEpisodes" defaultChecked={notifyEpisodes} className="h-4 w-4 rounded border-input" />
          New anime episodes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notifyChapters" defaultChecked={notifyChapters} className="h-4 w-4 rounded border-input" />
          New manga/manhwa/manhua chapters
        </label>
      </fieldset>

      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
          <Check className="h-4 w-4" /> Saved
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>

    <div className="mt-5 space-y-2 border-t border-border pt-5">
      <Label>Sessions</Label>
      <div className="flex flex-wrap gap-2">
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="h-3.5 w-3.5" /> Sign out this device
          </Button>
        </form>
        <form action={logoutAllSessionsAction}>
          <Button type="submit" variant="outline" size="sm" className="text-destructive">
            <LogOut className="h-3.5 w-3.5" /> Sign out everywhere
          </Button>
        </form>
      </div>
    </div>
    </>
  );
}

function Legend({ className, ...props }: React.FieldsetHTMLAttributes<HTMLLegendElement>) {
  return (
    <legend className={`text-sm font-medium ${className ?? ""}`} {...props} />
  );
}