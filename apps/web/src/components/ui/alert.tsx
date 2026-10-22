import type { HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm",
  {
    variants: {
      variant: {
        default: "border-border/70 bg-muted/40 text-foreground",
        info: "border-info/30 bg-info/10 text-info",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** `status` (polite) is the default; use `alert` for errors that must interrupt. */
  role?: "alert" | "status";
  icon?: ReactNode;
}

export function Alert({
  className,
  variant,
  role = "status",
  icon,
  children,
  ...props
}: AlertProps) {
  return (
    <div role={role} className={cn(alertVariants({ variant }), className)} {...props}>
      {icon ? (
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
