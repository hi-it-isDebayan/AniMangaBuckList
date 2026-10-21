"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Check } from "lucide-react";
import { registerSourceAction, type ActionResult } from "@/actions/sources";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const CONTENT_TYPES = [
  { value: "ANIME", label: "Anime" },
  { value: "MANGA", label: "Manga" },
  { value: "MANHWA", label: "Manhwa" },
  { value: "MANHUA", label: "Manhua" },
  { value: "LIGHT_NOVEL", label: "Light novel" },
  { value: "WEB_NOVEL", label: "Web novel" },
];

const emptyState: ActionResult = {};

export function RegisterSourceForm({ onDone }: { onDone?: () => void } = {}) {
  const [state, formAction, pending] = useActionState(registerSourceAction, emptyState);
  const formRef = useRef<HTMLFormElement>(null);
  // Set once the user confirms the saved entry, so the whole panel collapses.
  const [confirmed, setConfirmed] = useState(false);

  // A successful save clears the fields so a second entry starts blank.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  // After saving, the user reviews the result and presses Done to collapse.
  if (state.ok && confirmed) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
        <Check className="h-4 w-4" />
        {state.message ?? "Source saved."}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="source-url">Source URL</Label>
          <Input
            id="source-url"
            name="url"
            type="url"
            placeholder="https://example.com"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-name">Display name (optional)</Label>
          <Input id="source-name" name="name" placeholder="Example Scans" autoComplete="off" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Content</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {CONTENT_TYPES.map((type) => (
            <label key={type.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="contentTypes"
                value={type.value}
                className="h-4 w-4 rounded border-input"
              />
              {type.label}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {state.ok ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-300">
            <Check className="h-4 w-4" />
            {state.message ?? "Source saved."}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setConfirmed(true);
              onDone?.();
            }}
          >
            Done
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmed(true)}
          >
            Add another
          </Button>
        </div>
      ) : (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save source"}
        </Button>
      )}
    </form>
  );
}
