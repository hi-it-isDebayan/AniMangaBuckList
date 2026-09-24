import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
          <p className="text-sm text-muted-foreground">
            Your library and progress live here — private by default.
          </p>
        </div>
        <SignupForm />
      </CardContent>
    </Card>
  );
}