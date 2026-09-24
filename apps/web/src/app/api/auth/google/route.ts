import { NextResponse } from "next/server";
import { googleRedirectUri, setOAuthStateCookies } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/login?error=Google%20sign-in%20is%20not%20configured", request.url),
    );
  }

  const { state } = await setOAuthStateCookies();

  const authorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: googleRedirectUri(request),
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });

  return NextResponse.redirect(new URL(authorizeUrl));
}