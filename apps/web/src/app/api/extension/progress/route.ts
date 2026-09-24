import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { titles } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  extensionCorsHeaders,
  getBearerToken,
  unauthorized,
  verifyApiKey,
} from "@/lib/api-keys";
import { resolveTitle } from "@/lib/title-resolver";
import { recordProgress } from "@/lib/progress";

export const dynamic = "force-dynamic";

const progressSchema = z
  .object({
    titleId: z.string().uuid().optional(),
    malId: z.number().int().optional(),
    title: z.string().max(500).optional(),
    titleCandidates: z.array(z.string().max(500)).max(10).optional(),
    unit: z.enum(["EPISODE", "CHAPTER"]),
    value: z.number().int().min(1),
    kind: z.enum(["OPENED", "COMPLETED"]).default("OPENED"),
    sourceUrl: z.string().max(2000).optional(),
    source: z.string().max(60).optional(),
    host: z.string().max(255).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.titleId && !v.malId && !v.title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "titleId, malId or title is required.",
      });
    }
  });

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: extensionCorsHeaders(),
  });
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  const auth = token ? await verifyApiKey(token) : null;
  if (!auth) return unauthorized();

  const db = getDb();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const parsed = progressSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const {
    titleId: rawTitleId,
    malId,
    title,
    titleCandidates,
    unit,
    value,
    kind,
    source,
    sourceUrl,
    host,
  } = parsed.data;

  let titleId = rawTitleId;
  let resolved = false;

  if (!titleId) {
    if (malId) {
      const row = await db
        .select({ id: titles.id })
        .from(titles)
        .where(eq(titles.malId, malId))
        .limit(1);
      if (row[0]) {
        titleId = row[0].id;
        resolved = true;
      } else {
        return NextResponse.json(
          { error: "Title not found" },
          { status: 404, headers: extensionCorsHeaders() },
        );
      }
    } else if (title) {
      const out = await resolveTitle(db, {
        userId: auth.userId,
        title,
        titleCandidates,
        unit,
        value,
        host,
      });
      if (out.status === "resolved") {
        titleId = out.titleId!;
        resolved = true;
      } else {
        return NextResponse.json(
          {
            needsConfirmation: true,
            detected: {
              title,
              titleCandidates,
              normalized: out.normalized,
              unit,
              value,
              kind,
              source: source ?? null,
              sourceUrl: sourceUrl ?? null,
              host: host ?? null,
            },
            candidates: out.candidates,
          },
          { status: 409, headers: extensionCorsHeaders() },
        );
      }
    } else {
      return NextResponse.json(
        { error: "titleId, malId or title is required." },
        { status: 400, headers: extensionCorsHeaders() },
      );
    }
  }

  if (!titleId) {
    return NextResponse.json(
      { error: "Unable to resolve title." },
      { status: 409, headers: extensionCorsHeaders() },
    );
  }

  await recordProgress(db, {
    userId: auth.userId,
    titleId,
    unit,
    value,
    kind,
    source,
    sourceUrl,
  });

  return NextResponse.json(
    { ok: true, resolved, titleId },
    { headers: extensionCorsHeaders() },
  );
}