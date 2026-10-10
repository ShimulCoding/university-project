import { ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

type AccessLayoutProps = {
  title: string;
  description: string;
  kind: "system" | "event";
  children: React.ReactNode;
};

export function AccessLayout({
  title,
  description,
  kind,
  children,
}: AccessLayoutProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="section-shell py-8 sm:py-12"
    >
      <div className="grid overflow-hidden rounded-[2rem] border border-border bg-panel shadow-panel lg:grid-cols-[.9fr_1.1fr]">
        <section className="ledger-scene relative overflow-hidden p-7 text-white sm:p-10 lg:p-12">
          <div className="ledger-grid pointer-events-none absolute inset-0" />
          <div className="relative">
            <ShieldCheck
              className="h-8 w-8 text-[#bde7d6]"
              aria-hidden="true"
            />
            <div className="mt-10 text-xs uppercase tracking-[.18em] text-white/65">
              {kind === "system"
                ? "Platform governance"
                : "Your event. Your workspace."}
            </div>
            <h1 className="mt-5 text-balance font-display text-4xl font-normal leading-tight text-white sm:text-5xl">
              {title}
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/70">
              {description}
            </p>
            <div className="mt-10 flex items-start gap-3 border-t border-white/15 pt-6">
              <LockKeyhole
                className="mt-1 h-4 w-4 shrink-0 text-[#bde7d6]"
                aria-hidden="true"
              />
              <p className="text-xs leading-6 text-white/70">
                {kind === "system"
                  ? "System Admin accounts manage events, teams, and platform access."
                  : "Only active members of this event’s assigned team can enter."}
              </p>
            </div>
            <Link
              href="/events"
              className="focus-ring mt-6 flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-medium text-[#bde7d6]"
            >
              Browse public events
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
        <div className="min-w-0 p-5 sm:p-8 lg:p-10">{children}</div>
      </div>
    </main>
  );
}
