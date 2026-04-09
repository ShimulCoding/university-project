import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  compact?: boolean;
};

export function AppLogo({ className, compact = false }: AppLogoProps) {
  return (
    <Link
      href="/"
      className={cn("focus-ring inline-flex items-center gap-3 rounded-2xl", className)}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary text-primary-foreground shadow-panel">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-semibold tracking-[0.02em] text-foreground">
          MU CSE Transparency
        </div>
        <div className="text-xs text-muted-foreground">
          {compact ? "Audit-first finance" : "Financial transparency platform"}
        </div>
      </div>
    </Link>
  );
}
