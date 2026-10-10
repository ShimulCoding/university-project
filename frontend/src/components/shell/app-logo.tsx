import Link from "next/link";
import { Landmark } from "lucide-react";

import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
};

export function AppLogo({
  className,
  compact = false,
  inverse = false,
}: AppLogoProps) {
  return (
    <Link
      href="/"
      aria-label="MU CSE Transparency home"
      className={cn(
        "focus-ring inline-flex min-w-0 items-center gap-3 rounded-xl",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          inverse
            ? "border-white/15 bg-white/10 text-white"
            : "border-primary/10 bg-primary text-white",
        )}
      >
        <Landmark className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <div
          className={cn(
            "text-sm font-semibold tracking-tight",
            inverse ? "text-white" : "text-foreground",
          )}
        >
          MU CSE{" "}
          <span className={compact ? "hidden sm:inline" : ""}>
            Transparency
          </span>
        </div>
        <div
          className={cn(
            "mt-0.5 text-[11px]",
            inverse ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {compact ? "Society · Finance & events" : "Society finance & events"}
        </div>
      </div>
    </Link>
  );
}
