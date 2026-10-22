import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <Card className="noise-overlay border-border/70 bg-card/85 shadow-xl shadow-black/20 backdrop-blur-md">
      <CardContent className="pt-6">
        <div className="mb-6 space-y-1">
          <h1 className="font-display text-xl font-bold tracking-tight">Forgot password?</h1>
          <p className="text-sm text-muted-foreground">
            Enter your account&apos;s email and we&apos;ll send you a reset link.
          </p>
        </div>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}