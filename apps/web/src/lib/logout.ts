import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "./auth";

/**
 * Build the response for a logout request.
 *
 * Two things matter here:
 *
 * 1. Status `303 See Other`, not `307`. A logout is triggered by a form POST;
 *    a `307` preserves the method, so the browser re-POSTs the redirect target
 *    (`/login`) instead of simply navigating to it. `303` converts the
 *    follow-up request to a GET, which is what the login page expects.
 *
 * 2. A RELATIVE `Location`. Building it from `req.url` leaks the
 *    platform-internal origin into the header (on Render that is
 *    `http://localhost:10000`), sending users to an unreachable host.
 *
 * The session cookie is cleared explicitly on the response (with `Max-Age=0`)
 * so the browser actually deletes it rather than keeping an empty session
 * cookie around.
 */
export function logoutRedirect(): NextResponse {
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: "/login", "Cache-Control": "no-store" },
  });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
