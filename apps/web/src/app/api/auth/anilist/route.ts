import { NextResponse } from "next/server";
import {
  anilistRedirectUri,
  getOAuthBaseUrl,
  setOAuthStateCookies,
  type OAuthMode,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env.ANILIST_CLIENT_ID;
  const clientSecret = process.env.ANILIST_CLIENT_SECRET;
  const baseUrl = getOAuthBaseUrl(request, process.env.ANILIST_REDIRECT_URI);
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=Maybe%20add%20AniList%20credentials%20first", baseUrl),
    );
  }

  const url = new URL(request.url);
  const mode: OAuthMode = url.searchParams.get("mode") === "link" ? "link" : "signin";
  const { state } = await setOAuthStateCookies(mode);

  const authorizeUrl =
    "https://anilist.co/api/v2/oauth/authorize?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: anilistRedirectUri(request),
      response_type: "code",
      state,
    });

  return NextResponse.redirect(new URL(authorizeUrl));
}