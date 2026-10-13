"use client";

import { useActionState } from "react";
import { revokeKeyAction, type RevokeKeyState } from "@/actions/extension";
import { Button } from "@/components/ui/button";

export interface ApiKeyListItem {
  id: string;
  name: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const emptyState: RevokeKeyState = {};

function KeyRow({ item }: { item: ApiKeyListItem }) {
  const [state, formAction, pending] = useActionState(revokeKeyAction, emptyState);

  return (
    <div className="flex items-center justify-between p-2 rounded-lg border">
      <div>
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.lastFour} · Created {new Date(item.createdAt).toLocaleDateString()}
          {item.lastUsedAt ? " · Last used " + new Date(item.lastUsedAt).toLocaleDateString() : ""}
        </p>
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      </div>
      <form action={formAction}>
        <input type="hidden" name="keyId" value={item.id} />
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? "Removing…" : "Delete"}
        </Button>
      </form>
    </div>
  );
}

export function ApiKeysList({ items }: { items: ApiKeyListItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <KeyRow key={item.id} item={item} />
      ))}
    </div>
  );
}
