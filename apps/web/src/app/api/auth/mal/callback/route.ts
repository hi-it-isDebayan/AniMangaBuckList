import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { consumeOAuthCookies, findOrCreateOAuthUser, malRedirectUri } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state") ?? "";
  const clientId = process.env.MAL_CLIENT_ID;
  const clientSecret = process.env.MAL_CLIENT_SECRET;

  if (error || !code || !clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/login?error=MyAnimeList%20sign-in%20declined`, request.url),
    );
  }

  const { ok, verifier } = await consumeOAuthCookies(state);
  if (!ok || !verifier) {
    return NextResponse.redirect(
      new URL("/login?error=Stale%20sign-in%20request%2C%20try%20again", request.url),
    );
  }

  try {
    const tokenRes = await fetch("https://myanimelist.net/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-MAL-CLIENT-ID": clientId,
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: malRedirectUri(request),
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=MyAnimeList%20token%20exchange%20failed", request.url),
      );
    }
    const token = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
    };

    const meRes = await fetch("https://api.myanimelist.net/v2/users/@me?fields=id,name,picture", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "X-MAL-CLIENT-ID": clientId,
      },
    });
    if (!meRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=Could%20not%20fetch%20MAL%20profile", request.url),
      );
    }
    const me = (await meRes.json()) as { id: number; name?: string };

    const userId = await findOrCreateOAuthUser({
      provider: "mal",
      providerId: String(me.id),
      displayName: me.name,
    });
    await createSession(userId);
    return NextResponse.redirect(new URL("/", request.url));
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=MyAnimeList%20sign-in%20failed", request.url),
    );
  }
}