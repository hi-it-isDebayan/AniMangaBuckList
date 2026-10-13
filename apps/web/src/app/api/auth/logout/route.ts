import { NextResponse } from "next/server";
import { SESSION_COOKIE, destroyCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function clearCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: Request) {
  await destroyCurrentSession();
  const res = NextResponse.redirect(new URL("/login", req.url));
  return clearCookie(res);
}

export async function GET(req: Request) {
  return POST(req);
}
