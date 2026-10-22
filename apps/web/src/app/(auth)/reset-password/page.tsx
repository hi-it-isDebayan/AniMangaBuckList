import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const validFormat = typeof token === "string" && token.length >= 20 && token.length <= 256;

  return (
    <Card className="noise-overlay border-border/70 bg-card/85 shadow-xl shadow-black/20 backdrop-blur-md">
      <CardContent className="pt-6">
        <div className="mb-6 space-y-1">
          <h1 className="font-display text-xl font-bold tracking-tight">
            Choose a new password
          </h1>
          <p className="text-sm text-muted-foreground">
            {validFormat
              ? "Set a new password to sign in with. All your other devices will be signed out."
              : "This reset link is invalid or expired."}
          </p>
        </div>
        {validFormat ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm text-destructive">
            Request a fresh link.{" "}
            <a href="/forgot-password" className="font-medium text-primary underline">
              Get a new reset link
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}