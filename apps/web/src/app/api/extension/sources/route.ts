import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  extensionCorsHeaders,
  getBearerToken,
  unauthorized,
  verifyApiKey,
} from "@/lib/api-keys";
import { parseSourceUrl } from "@/lib/sources/domain";
import { extractorLabel, extractorStatusFor } from "@/lib/sources/extractors";
import { probeSource } from "@/lib/sources/probe";
import * as service from "@/lib/sources/service";

export const dynamic = "force-dynamic";

const bodySchema = z.union([
  z.object({ action: z.literal("validate"), url: z.string().trim().min(1).max(500) }),
  z.object({
    action: z.literal("register"),
    url: z.string().trim().min(1).max(500),
    name: z.string().trim().max(120).optional(),
    contentTypes: z.array(z.string()).max(6).optional(),
  }),
  z.object({ action: z.literal("link"), sourceId: z.string().uuid() }),
  z.object({ action: z.literal("unlink"), sourceId: z.string().uuid() }),
  z.object({ action: z.literal("test"), sourceId: z.string().uuid() }),
  z.object({ action: z.literal("probe"), url: z.string().trim().min(1).max(500) }),
]);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: extensionCorsHeaders() });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders() });
}

/** The extension popup lists the user's linked sources. */
export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  const auth = token ? await verifyApiKey(token) : null;
  if (!auth) return unauthorized();

  const links = await service.listLinkedSources(auth.userId);
  return NextResponse.json(
    {
      sources: links.map((link) => ({
        sourceId: link.id,
        domain: link.domain,
        name: link.name,
        homepageUrl: link.homepageUrl,
        status: link.status,
        extractorStatus: link.extractorStatus,
        lastCheckedAt: link.lastCheckedAt,
        lastSuccessAt: link.lastSuccessAt,
        consecutiveFailures: link.consecutiveFailures,
        failureCategory: link.lastFailureCategory,
      })),
    },
    { headers: extensionCorsHeaders() },
  );
}

/**
 * Link & test from the extension. Every mutation runs through the same service
 * (and therefore the same authorization and dedupe rules) as the web app; the
 * probe is SSRF-safe and reports reachability and extraction separately.
 */
export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  const auth = token ? await verifyApiKey(token) : null;
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  const input = parsed.data;

  if (input.action === "validate") {
    const canonical = parseSourceUrl(input.url);
    if (!canonical.ok) return badRequest(canonical.reason);
    return NextResponse.json(
      {
        domain: canonical.value.domain,
        homepageUrl: canonical.value.homepageUrl,
        extractorStatus: extractorStatusFor(canonical.value.domain),
        extractorLabel: extractorLabel(canonical.value.domain),
      },
      { headers: extensionCorsHeaders() },
    );
  }

  if (input.action === "probe") {
    const canonical = parseSourceUrl(input.url);
    if (!canonical.ok) return badRequest(canonical.reason);
    const probe = await probeSource(canonical.value.homepageUrl);
    return NextResponse.json({ probe }, { headers: extensionCorsHeaders() });
  }

  if (input.action === "register") {
    const result = await service.registerSource(auth.userId, {
      url: input.url,
      name: input.name,
      contentTypes: input.contentTypes,
    });
    if (!result.ok || !result.sourceId) return badRequest(result.error ?? "Could not register.");
    await service.linkSource(auth.userId, result.sourceId);
    return NextResponse.json(
      { sourceId: result.sourceId, created: result.created, linked: true },
      { headers: extensionCorsHeaders() },
    );
  }

  if (input.action === "link") {
    const result = await service.linkSource(auth.userId, input.sourceId);
    if (!result.ok) return badRequest(result.error ?? "Could not link.");
    return NextResponse.json({ linked: true }, { headers: extensionCorsHeaders() });
  }

  if (input.action === "unlink") {
    await service.unlinkSource(auth.userId, input.sourceId);
    return NextResponse.json({ linked: false }, { headers: extensionCorsHeaders() });
  }

  // action === "test"
  const result = await service.testSource(input.sourceId, {
    trigger: "MANUAL",
    checkedBy: auth.userId,
  });
  if (!result.ok || !result.probe) return badRequest(result.error ?? "Could not run the test.");
  return NextResponse.json({ probe: result.probe }, { headers: extensionCorsHeaders() });
}
