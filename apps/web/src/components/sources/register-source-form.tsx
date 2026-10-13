"use client";

import { useActionState } from "react";
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

export function RegisterSourceForm() {
  const [state, formAction, pending] = useActionState(registerSourceAction, emptyState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="source-url">Source URL</Label>
          <Input
            id="source-url"
            name="url"
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
      {state.message ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-300">{state.message}</p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Registering…" : "Register source"}
      </Button>
    </form>
  );
}
