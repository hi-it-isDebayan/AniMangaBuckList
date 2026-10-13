import { destroyCurrentSession } from "@/lib/auth";
import { logoutRedirect } from "@/lib/logout";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroyCurrentSession();
  return logoutRedirect();
}

export async function GET() {
  await destroyCurrentSession();
  return logoutRedirect();
}
