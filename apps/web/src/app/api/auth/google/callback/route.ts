import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { consumeOAuthCookies, findOrCreateOAuthUser, googleRedirectUri } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state") ?? "";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (error || !code || !clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=Google%20sign-in%20declined", request.url),
    );
  }

  const { ok } = await consumeOAuthCookies(state);
  if (!ok) {
    return NextResponse.redirect(
      new URL("/login?error=Stale%20sign-in%20request%2C%20try%20again", request.url),
    );
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: googleRedirectUri(request),
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=Google%20token%20exchange%20failed", request.url),
      );
    }
    const token = (await tokenRes.json()) as { id_token?: string };

    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token ?? "")}`,
    );
    if (!infoRes.ok || !token.id_token) {
      return NextResponse.redirect(
        new URL("/login?error=Could%20not%20verify%20Google%20identity", request.url),
      );
    }
    const info = (await infoRes.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string;
      name?: string;
      sub?: string;
    };

    if (!info.sub || info.aud !== clientId || info.email_verified !== "true" || !info.email) {
      return NextResponse.redirect(
        new URL("/login?error=Google%20identity%20could%20not%20be%20verified", request.url),
      );
    }

    const userId = await findOrCreateOAuthUser({
      provider: "google",
      providerId: info.sub,
      email: info.email,
      displayName: info.name,
    });
    await createSession(userId);
    return NextResponse.redirect(new URL("/", request.url));
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=Google%20sign-in%20failed", request.url),
    );
  }
}