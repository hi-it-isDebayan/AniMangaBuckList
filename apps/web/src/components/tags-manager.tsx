"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addTagAction, removeTagAction } from "@/actions/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface TagItem {
  id: string;
  name: string;
}

export function TagsManager({
  titleId,
  tags,
}: {
  titleId: string;
  tags: TagItem[];
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const add = async () => {
    const name = input.trim();
    if (!name || busy) return;
    setBusy(true);
    const res = await addTagAction({ titleId, name });
    setBusy(false);
    if (res.ok) {
      setInput("");
      router.refresh();
    }
  };

  const remove = async (tagId: string) => {
    await removeTagAction({ titleId, tagId });
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1 pl-2.5">
            {tag.name}
            <button
              type="button"
              onClick={() => void remove(tag.id)}
              aria-label={`Remove tag ${tag.name}`}
              className="rounded-full p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {tags.length === 0 && (
          <span className="text-sm text-muted-foreground">No tags yet.</span>
        )}
      </div>
      <div className="flex max-w-xs items-center gap-2">
        <Input
          placeholder="Add a tag…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <Button size="icon" variant="outline" onClick={() => void add()} aria-label="Add tag">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}