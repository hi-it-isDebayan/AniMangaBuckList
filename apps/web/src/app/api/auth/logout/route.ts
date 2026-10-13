import { NextResponse } from "next/server";
import { SESSION_COOKIE, destroyCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Emit a RELATIVE redirect. Building the URL from `req.url` would leak the
// platform-internal origin into the Location header (on Render that is
// http://localhost:10000), sending users to an unreachable host after logout.
function loginRedirect(): NextResponse {
  const res = new NextResponse(null, { status: 307 });
  res.headers.set("Location", "/login");
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST() {
  await destroyCurrentSession();
  return loginRedirect();
}

export async function GET() {
  await destroyCurrentSession();
  return loginRedirect();
}
