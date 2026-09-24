"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { saveNotesAction } from "@/actions/library";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function NotesEditor({
  titleId,
  initial,
}: {
  titleId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const save = async () => {
    setSaving(true);
    const res = await saveNotesAction({ titleId, content: value });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Private notes about this title…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
      />
      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="text-xs text-emerald-500">Saved</span>
        )}
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save note
        </Button>
      </div>
    </div>
  );
}