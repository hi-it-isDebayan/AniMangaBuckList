"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveExternalLinkAction, removeExternalLinkAction } from "@/actions/library";
import type { LinkType } from "@ambl/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { X } from "lucide-react";
import { relationTypeLabel } from "@/lib/format";

const linkTypes: LinkType[] = ["READ", "STREAM", "OFFICIAL", "USER_SAVED", "MAL"];

export function ExternalLinksManager({
  titleId,
  links,
}: {
  titleId: string;
  links: { id: string; provider: string; url: string; linkType: LinkType }[];
}) {
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState("Official");
  const [linkType, setLinkType] = useState<LinkType>("READ");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const add = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    await saveExternalLinkAction({ titleId, provider, url: url.trim(), linkType });
    setBusy(false);
    setUrl("");
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="sm:w-32"
        />
        <Select
          value={linkType}
          onChange={(e) => setLinkType(e.target.value as LinkType)}
          className="sm:w-36"
          aria-label="Link type"
        >
          {linkTypes.map((t) => (
            <option key={t} value={t}>
              {relationTypeLabel(t)}
            </option>
          ))}
        </Select>
        <Button onClick={() => void add()} disabled={busy} size="sm">
          Add
        </Button>
      </div>
      {links.length > 0 && (
        <ul className="space-y-1.5">
          {links.map((link) => (
            <li key={link.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {relationTypeLabel(link.linkType)}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-primary hover:underline"
              >
                {link.provider} — {link.url}
              </a>
              <button
                type="button"
                onClick={async () => {
                  await removeExternalLinkAction({ linkId: link.id, titleId });
                  router.refresh();
                }}
                aria-label={`Remove ${link.provider} link`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}