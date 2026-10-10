import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { webauthnCredentials } from "@ambl/database";
import { getDb } from "@/lib/db";
import { requireUser, deviceLabelFromUA } from "@/lib/auth";
import { deleteChallenge, findChallenge } from "@/lib/passkeys";
import { webauthnOrigins, webauthnRpId } from "@/lib/webauthn";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = (await request.json().catch(() => null)) as {
    serverChallenge?: string;
    rawId?: string;
    response?: unknown;
  } | null;
  if (!body?.response || typeof body.serverChallenge !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const challengeRow = await findChallenge("register", body.serverChallenge, user.id);
  if (!challengeRow) {
    return NextResponse.json(
      { ok: false, error: "Registration challenge expired or missing. Try again." },
      { status: 400 },
    );
  }

  const db = getDb();
  try {
    const verification = await verifyRegistrationResponse({
      response: body as never,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: webauthnOrigins(),
      expectedRPID: webauthnRpId(),
    });
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ ok: false, error: "Verification failed." }, { status: 400 });
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    const dup = await db
      .select({ id: webauthnCredentials.id })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, credential.id))
      .limit(1);
    if (dup[0]) {
      return NextResponse.json(
        { ok: false, error: "This passkey was already registered on this device." },
        { status: 409 },
      );
    }

    await db.insert(webauthnCredentials).values({
      userId: user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: ((body as { response?: { transports?: string[] } }).response as { transports?: string[] })
        ?.transports ?? ["internal"],
      name: deviceLabelFromUA(request.headers.get("user-agent") ?? undefined) || "Passkey",
    });
    await deleteChallenge(challengeRow.id);
    return NextResponse.json({ ok: true, deviceType: credentialDeviceType, backedUp: credentialBackedUp });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}