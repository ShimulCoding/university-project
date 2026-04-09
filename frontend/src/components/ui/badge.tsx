import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-[0.02em]",
  {
    variants: {
      variant: {
        neutral: "border-border bg-panel text-foreground",
        info: "border-primary/15 bg-primary/5 text-primary",
        success: "border-success/15 bg-success-muted text-success",
        warning: "border-warning/20 bg-warning-muted text-warning-foreground",
        danger: "border-destructive/15 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
