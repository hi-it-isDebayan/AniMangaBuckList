import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { saveChallenge } from "@/lib/passkeys";
import { webauthnRpId } from "@/lib/webauthn";

export async function POST(_request: NextRequest) {
  const options = await generateAuthenticationOptions({
    rpID: webauthnRpId(),
    userVerification: "preferred",
  });
  await saveChallenge(null, "authenticate", options.challenge);
  return NextResponse.json({ options });
}