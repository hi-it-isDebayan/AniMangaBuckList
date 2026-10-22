import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <Card className="noise-overlay border-border/70 bg-card/85 shadow-xl shadow-black/20 backdrop-blur-md">
      <CardContent className="pt-6">
        <div className="mb-6 space-y-1">
          <h1 className="font-display text-xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Your library and progress live here — private by default.
          </p>
        </div>
        <SignupForm />
      </CardContent>
    </Card>
  );
}