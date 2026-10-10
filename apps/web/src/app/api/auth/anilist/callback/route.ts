import { NextResponse } from "next/server";
import { createSession, getCurrentUser } from "@/lib/auth";
import {
  anilistRedirectUri,
  consumeOAuthCookies,
  findOrCreateOAuthUser,
  getOAuthBaseUrl,
  linkOAuthAccount,
} from "@/lib/oauth";
import { saveProviderTokens } from "@/lib/provider-tokens";
import { syncProviderEntries } from "@/lib/provider-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state") ?? "";
  const clientId = process.env.ANILIST_CLIENT_ID;
  const clientSecret = process.env.ANILIST_CLIENT_SECRET;
  const baseUrl = getOAuthBaseUrl(request, process.env.ANILIST_REDIRECT_URI);

  if (error || !code || !clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/login?error=AniList%20sign-in%20declined`, baseUrl),
    );
  }

  const { ok, mode } = await consumeOAuthCookies(state);
  if (!ok) {
    return NextResponse.redirect(
      new URL("/login?error=Stale%20sign-in%20request%2C%20try%20again", baseUrl),
    );
  }

  try {
    const tokenRes = await fetch("https://anilist.co/api/v2/oauth/token", {
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
        redirect_uri: anilistRedirectUri(request),
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=AniList%20token%20exchange%20failed", baseUrl),
      );
    }
    const token = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!token.access_token) {
      return NextResponse.redirect(
        new URL("/login?error=AniList%20token%20exchange%20failed", baseUrl),
      );
    }

    const viewerQuery = `query { Viewer { id name avatar { large } } }`;
    const viewerRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token.access_token}`,
      },
      cache: "no-store",
      body: JSON.stringify({ query: viewerQuery }),
    });
    if (!viewerRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=Could%20not%20fetch%20AniList%20profile", baseUrl),
      );
    }
    const viewerJson = (await viewerRes.json()) as {
      data?: { Viewer?: { id?: number; name?: string; avatar?: { large?: string } } };
      errors?: { message?: string }[];
    };
    const viewer = viewerJson.data?.Viewer;
    if (!viewer?.id) {
      return NextResponse.redirect(
        new URL("/login?error=Could%20not%20fetch%20AniList%20profile", baseUrl),
      );
    }

    const identity = {
      providerId: String(viewer.id),
      displayName: viewer.name,
      pictureUrl: viewer.avatar?.large,
    };

    let userId: string;
    if (mode === "link") {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.redirect(
          new URL("/login?error=Please%20sign%20in%20first", baseUrl),
        );
      }
      try {
        await linkOAuthAccount(user.id, "anilist", identity);
      } catch (err) {
        return NextResponse.redirect(
          new URL(`/settings?error=${encodeURIComponent((err as Error).message)}`, baseUrl),
        );
      }
      userId = user.id;
    } else {
      userId = await findOrCreateOAuthUser("anilist", identity);
      await createSession(userId);
    }

    await saveProviderTokens(userId, "anilist", {
      accessToken: token.access_token,
      refreshToken: null,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
    });
    await syncProviderEntries(userId, "anilist");

    return NextResponse.redirect(
      new URL(mode === "link" ? "/settings" : "/", baseUrl),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=AniList%20sign-in%20failed", baseUrl),
    );
  }
}