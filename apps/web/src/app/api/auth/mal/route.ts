import { NextResponse } from "next/server";
import { setOAuthStateCookies } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env.MAL_CLIENT_ID;
  const clientSecret = process.env.MAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=Maybe%20add%20MAL%20credentials%20first", request.url),
    );
  }

  const { state, verifier } = await setOAuthStateCookies();

  const authorizeUrl =
    `https://myanimelist.net/v1/oauth2/authorize?` +
    new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      code_challenge: verifier,
      code_challenge_method: "plain",
      state,
    });

  return NextResponse.redirect(new URL(authorizeUrl));
}