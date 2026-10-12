import { and, eq } from "drizzle-orm";
import { titleExternalIds } from "@ambl/database";
import type { MediaType } from "@ambl/types";
import { getDb } from "@/lib/db";

export interface ExternalIdLink {
  provider: string;
  externalId: string | number | null | undefined;
}

function normalize(link: ExternalIdLink) {
  const raw = link.externalId;
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;
  return { provider: link.provider, externalId: value };
}

export function malProviderKey(mediaType: MediaType | string): string {
  return mediaType === "ANIME" ? "mal:anime" : "mal:manga";
}

export function metadataProviderKey(
  providerName: string,
  mediaType: MediaType | string,
): string {
  const name = providerName.trim().toLowerCase();
  if (name === "mal" || name === "jikan") return malProviderKey(mediaType);
  return name;
}

export function mangabakaLink(
  externalId: string | number | null | undefined,
): ExternalIdLink {
  return { provider: "mangabaka", externalId };
}

export function anilistLink(
  externalId: string | number | null | undefined,
): ExternalIdLink {
  return { provider: "anilist", externalId };
}

export async function linkExternalIds(
  titleId: string,
  links: ExternalIdLink[],
): Promise<void> {
  const values = links
    .map(normalize)
    .filter((v): v is { provider: string; externalId: string } => v !== null)
    .map((v) => ({ titleId, ...v }));
  if (values.length === 0) return;

  await getDb()
    .insert(titleExternalIds)
    .values(values)
    .onConflictDoNothing({
      target: [titleExternalIds.provider, titleExternalIds.externalId],
    });
}

export async function findTitleIdByExternalId(
  provider: string,
  externalId: string | number | null | undefined,
): Promise<string | null> {
  const normalized = normalize({ provider, externalId });
  if (!normalized) return null;

  const rows = await getDb()
    .select({ titleId: titleExternalIds.titleId })
    .from(titleExternalIds)
    .where(
      and(
        eq(titleExternalIds.provider, normalized.provider),
        eq(titleExternalIds.externalId, normalized.externalId),
      ),
    )
    .limit(1);

  return rows[0]?.titleId ?? null;
}

export async function findTitleIdByAnyLink(
  links: ExternalIdLink[],
): Promise<string | null> {
  for (const link of links) {
    const found = await findTitleIdByExternalId(link.provider, link.externalId);
    if (found) return found;
  }
  return null;
}
