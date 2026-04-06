import { ShieldCheck, WalletCards, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";

const pillars = [
  {
    title: "Evidence-linked finance",
    description:
      "Registration income, manual income sources, expense requests, and settled expense records stay traceable from day one.",
    icon: WalletCards,
  },
  {
    title: "Approval-first operations",
    description:
      "The scaffold is prepared for RBAC, separated approval flows, and reconciliation before public publication.",
    icon: Workflow,
  },
  {
    title: "Audit-ready foundation",
    description:
      "The project starts with modular boundaries so we can grow features without collapsing the control logic.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(23,120,102,0.16),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,1)_0%,_rgba(249,245,237,1)_100%)]">
      <section className="container py-20">
        <div className="mx-auto max-w-4xl">
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Version 1 scaffold
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            MU CSE Financial Transparency System
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            This frontend is scaffolded for a backend-first, audit-oriented workflow
            platform with public-safe reporting, complaint handling, and structured
            financial controls.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button>Build Public Event Flow</Button>
            <Button variant="outline">Connect Backend Modules</Button>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <article
                key={pillar.title}
                className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-sm backdrop-blur"
              >
                <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold">{pillar.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {pillar.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

