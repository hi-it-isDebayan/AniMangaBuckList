"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import type { ProgressKind, ProgressUnit } from "@ambl/types";
import { updateProgressAction } from "@/actions/library";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ProgressControl({
  titleId,
  unit,
  label,
  opened,
  completed,
  total,
}: {
  titleId: string;
  unit: ProgressUnit;
  label: string;
  opened: number | null;
  completed: number | null;
  total: number | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ProgressRow
        titleId={titleId}
        unit={unit}
        label={`Last opened (${label.toLowerCase()})`}
        kind="OPENED"
        value={opened}
        total={total}
      />
      <ProgressRow
        titleId={titleId}
        unit={unit}
        label={`Completed (${label.toLowerCase()})s`}
        kind="COMPLETED"
        value={completed}
        total={total}
      />
    </div>
  );
}

function ProgressRow({
  titleId,
  unit,
  label,
  kind,
  value,
  total,
}: {
  titleId: string;
  unit: ProgressUnit;
  label: string;
  kind: ProgressKind;
  value: number | null;
  total: number | null;
}) {
  const [input, setInput] = useState<string>(value != null ? String(value) : "0");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const parsed = Math.max(0, Math.floor(Number(input) || 0));

  const save = async (next: number) => {
    setInput(String(next));
    setSaving(true);
    const res = await updateProgressAction({ titleId, unit, kind, value: next });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <div className="rounded-md border p-3">
      <Label className="mb-2 block text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => void save(parsed - 1)}
          aria-label="Decrease"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Input
          type="number"
          min={0}
          className="h-8 w-20 text-center"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save(parsed);
          }}
        />
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => void save(parsed + 1)}
          aria-label="Increase"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        {total != null && (
          <span className="text-xs text-muted-foreground">/ {total}</span>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto h-8 w-8"
          disabled={saving}
          onClick={() => void save(parsed)}
          aria-label="Save"
        >
          {saved ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <span className="text-xs font-medium">{saving ? "…" : "OK"}</span>
          )}
        </Button>
      </div>
    </div>
  );
}