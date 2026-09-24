"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import {
  generateKeyAction,
  revokeKeyAction,
  type GenerateKeyState,
  type RevokeKeyState,
} from "@/actions/extension";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const emptyGenerateState: GenerateKeyState = {};
const emptyRevokeState: RevokeKeyState = {};

type ApiKeySummary = {
  id: string;
  name: string;
  lastFour: string;
  createdAt: string;
};

export function ApiKeyManager({ keys }: { keys: ApiKeySummary[] }) {
  return (
    <div className="space-y-4">
      <GenerateKeyForm />
      {keys.length > 0 && (
        <div className="space-y-2">
          {keys.map((key) => (
            <KeyRow key={key.id} {...key} />
          ))}
        </div>
      )}
    </div>
  );
}

function GenerateKeyForm() {
  const [state, formAction, pending] = useActionState(
    generateKeyAction,
    emptyGenerateState,
  );
  const [copied, setCopied] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      {state?.key && (
        <div className="space-y-1.5">
          <Label>New API key</Label>
          <div className="flex gap-2">
            <Input value={state.key} readOnly aria-label="New API key" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(state.key ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            This key is shown only once. After you leave this page, only the
            last four characters can be recovered.
          </p>
        </div>
      )}
      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="keyName">Name</Label>
          <Input
            id="keyName"
            name="name"
            placeholder="Extension"
            defaultValue={state?.name}
            maxLength={100}
            className="w-56"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <KeyRound className="h-3.5 w-3.5" />
          Generate
        </Button>
      </div>
    </form>
  );
}

function KeyRow(key: ApiKeySummary) {
  const [state, formAction, pending] = useActionState(
    revokeKeyAction,
    emptyRevokeState,
  );

  return (
    <form action={formAction} className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <input type="hidden" name="keyId" value={key.id} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{key.name}</p>
        <p className="text-sm text-muted-foreground">
          ••••{key.lastFour} · created {new Date(key.createdAt).toLocaleDateString()}
        </p>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={pending}
      >
        <Trash2 className="h-3.5 w-3.5" /> Revoke
      </Button>
    </form>
  );
}