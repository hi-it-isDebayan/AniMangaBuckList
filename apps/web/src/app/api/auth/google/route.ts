import { NextResponse } from "next/server";
import {
  getOAuthBaseUrl,
  googleRedirectUri,
  setOAuthStateCookies,
  type OAuthMode,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = getOAuthBaseUrl(request, process.env.GOOGLE_REDIRECT_URI);
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/login?error=Google%20sign-in%20is%20not%20configured", baseUrl),
    );
  }

  const url = new URL(request.url);
  const mode: OAuthMode = url.searchParams.get("mode") === "link" ? "link" : "signin";
  const { state } = await setOAuthStateCookies(mode);

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