import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">AniMangaBuckList</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue your reading and watching.
          </p>
        </div>
        <LoginForm />
      </CardContent>
    </Card>
  );
}