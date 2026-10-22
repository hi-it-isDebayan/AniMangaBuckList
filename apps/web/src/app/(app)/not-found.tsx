import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
        <Compass className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="font-display text-xl font-bold tracking-tight">
          We couldn&apos;t find that
        </h1>
        <p className="text-sm text-muted-foreground">
          This title or page doesn&apos;t exist, or it may have been removed.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className={buttonVariants()}>
          Back to home
        </Link>
        <Link href="/library" className={buttonVariants({ variant: "outline" })}>
          Open library
        </Link>
      </div>
    </div>
  );
}
