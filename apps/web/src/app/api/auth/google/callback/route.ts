import { NextResponse } from "next/server";
import { createSession, getCurrentUser } from "@/lib/auth";
import {
  consumeOAuthCookies,
  findOrCreateOAuthUser,
  getOAuthBaseUrl,
  googleRedirectUri,
  linkOAuthAccount,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state") ?? "";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = getOAuthBaseUrl(request, process.env.GOOGLE_REDIRECT_URI);

  if (error || !code || !clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=Google%20sign-in%20declined", baseUrl),
    );
  }

  const { ok, mode } = await consumeOAuthCookies(state);
  if (!ok) {
    return NextResponse.redirect(
      new URL("/login?error=Stale%20sign-in%20request%2C%20try%20again", baseUrl),
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
        new URL("/login?error=Google%20token%20exchange%20failed", baseUrl),
      );
    }
    const token = (await tokenRes.json()) as { id_token?: string; access_token?: string };

    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token ?? "")}`,
    );
    if (!infoRes.ok || !token.id_token) {
      return NextResponse.redirect(
        new URL("/login?error=Could%20not%20verify%20Google%20identity", baseUrl),
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
        new URL("/login?error=Google%20identity%20could%20not%20be%20verified", baseUrl),
      );
    }

    let picture: string | undefined;
    if (token.access_token) {
      try {
        const profileRes = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          { headers: { Authorization: `Bearer ${token.access_token}` } },
        );
        if (profileRes.ok) {
          const profile = (await profileRes.json()) as { picture?: string; name?: string };
          picture = profile.picture;
        }
      } catch {
        // avatar is optional
      }
    }

    const identity = {
      providerId: info.sub,
      email: info.email,
      displayName: info.name,
      pictureUrl: picture,
    };

    if (mode === "link") {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.redirect(
          new URL("/login?error=Please%20sign%20in%20first", baseUrl),
        );
      }
      try {
        await linkOAuthAccount(user.id, "google", identity);
      } catch (err) {
        return NextResponse.redirect(
          new URL(`/settings?error=${encodeURIComponent((err as Error).message)}`, baseUrl),
        );
      }
      return NextResponse.redirect(new URL("/settings", baseUrl));
    }

    const userId = await findOrCreateOAuthUser("google", identity);
    await createSession(userId);
    return NextResponse.redirect(new URL("/", baseUrl));
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=Google%20sign-in%20failed", baseUrl),
    );
  }
}