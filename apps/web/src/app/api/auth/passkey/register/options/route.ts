import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { webauthnCredentials } from "@ambl/database";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { saveChallenge } from "@/lib/passkeys";
import { webauthnRpId, webauthnRpName } from "@/lib/webauthn";

export async function POST() {
  const user = await requireUser();
  const db = getDb();
  const existing = await db
    .select({ credentialId: webauthnCredentials.credentialId })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, user.id));

  const options = await generateRegistrationOptions({
    rpID: webauthnRpId(),
    rpName: webauthnRpName(),
    userName: user.email,
    userDisplayName: user.displayName || user.email,
    userID: Buffer.from(user.id, "utf8"),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await saveChallenge(user.id, "register", options.challenge);
  return NextResponse.json({ options });
}