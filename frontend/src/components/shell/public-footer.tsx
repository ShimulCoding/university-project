import Link from "next/link";

import { publicNavigation } from "@/lib/navigation";
import { AppLogo } from "@/components/shell/app-logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/70 bg-panel">
      <div className="section-shell grid gap-10 py-12 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div className="space-y-4">
          <AppLogo />
          <p className="max-w-xl text-sm leading-7 text-muted-foreground">
            A trust-first financial transparency platform for MU CSE Society,
            designed to keep public-safe reporting clearly separated from internal
            financial review, approval, and evidence workflows.
          </p>
        </div>
        <div>
          <div className="data-kicker">Public navigation</div>
          <div className="mt-4 space-y-3">
            {publicNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block text-sm text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="data-kicker">Control boundary</div>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
            <p>Only finalized reconciliation can cross into public publication.</p>
            <p>Protected evidence, reviewer notes, and complaint details stay internal.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
