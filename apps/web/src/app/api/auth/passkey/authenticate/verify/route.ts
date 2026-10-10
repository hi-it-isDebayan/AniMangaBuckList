import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { webauthnCredentials } from "@ambl/database";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { deleteChallenge, findChallenge, getCredentialByCredentialId, publicKeyFromBase64Url } from "@/lib/passkeys";
import { webauthnOrigins, webauthnRpId } from "@/lib/webauthn";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    serverChallenge?: string;
    id?: string;
    response?: unknown;
  } | null;
  if (!body?.response || !body.id || typeof body.serverChallenge !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const challengeRow = await findChallenge("authenticate", body.serverChallenge);
  if (!challengeRow) {
    return NextResponse.json(
      { ok: false, error: "Sign-in challenge expired. Try again." },
      { status: 400 },
    );
  }

  const credential = await getCredentialByCredentialId(body.id);
  if (!credential) {
    return NextResponse.json(
      { ok: false, error: "This passkey is not recognized. Remove and re-add it." },
      { status: 400 },
    );
  }

  const db = getDb();
  try {
    const verification = await verifyAuthenticationResponse({
      response: body as never,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: webauthnOrigins(),
      expectedRPID: webauthnRpId(),
      credential: {
        id: credential.credentialId,
        publicKey: publicKeyFromBase64Url(credential.publicKey),
        counter: credential.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ ok: false, error: "Signature verification failed." }, { status: 400 });
    }

    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter > 0 && newCounter <= credential.counter) {
      return NextResponse.json(
        { ok: false, error: "Passkey reuse detected. Try again." },
        { status: 400 },
      );
    }

    await db
      .update(webauthnCredentials)
      .set({ counter: newCounter, lastUsedAt: new Date() })
      .where(eq(webauthnCredentials.id, credential.id));

    await deleteChallenge(challengeRow.id);

    await createSession(credential.userId, {
      ua: request.headers.get("user-agent") ?? undefined,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}