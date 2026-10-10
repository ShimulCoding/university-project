import Link from "next/link";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { publicNavigation } from "@/lib/navigation";
import { AppLogo } from "@/components/shell/app-logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-panel">
      <div className="section-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <AppLogo />
          <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
            A clearer view of society events and their finances. Built for the
            MU CSE community.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <div className="data-kicker">Explore the platform</div>
          <div className="mt-4 space-y-1">
            {publicNavigation.map((item) => (
              <Link
                key={item.href}
                className="focus-ring flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted-foreground hover:text-success"
                href={item.href}
              >
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ))}
            <Link
              href="/complaints"
              className="focus-ring flex min-h-11 w-fit items-center rounded-lg text-sm text-muted-foreground hover:text-success"
            >
              Student area
            </Link>
          </div>
        </nav>
        <div>
          <div className="data-kicker">Open reporting. Private records.</div>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            Published summaries share approved financial totals. Personal
            information, payment evidence, and complaint details stay protected.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-success">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Privacy by design
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:col-span-3">
          <span>Metropolitan University · CSE Society</span>
          <span>Clarity in every event. Accountability in every report.</span>
        </div>
      </div>
    </footer>
  );
}
