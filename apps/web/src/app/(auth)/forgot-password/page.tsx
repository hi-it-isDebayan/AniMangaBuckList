import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Forgot password?</h1>
          <p className="text-sm text-muted-foreground">
            Enter your account's email and we'll send you a reset link.
          </p>
        </div>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}