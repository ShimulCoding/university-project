import Link from "next/link";
import { ArrowRight, Eye, ShieldCheck, Sparkles } from "lucide-react";

import {
  controlCadence,
  disclosureBoundary,
  landingMetrics,
  publicEventCards,
  publishedSummaries,
  trustPillars,
} from "@/features/foundation/data/demo-content";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const publishedSummary = publishedSummaries[0];

export default function HomePage() {
  return (
    <PublicPageShell>
      <main>
        <section className="section-shell py-12 sm:py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_380px]">
            <div className="space-y-8">
              <div className="space-y-5">
                <Badge variant="info">Trust-first financial transparency</Badge>
                <div className="max-w-4xl">
                  <h1 className="headline-display max-w-4xl text-balance text-primary">
                    Financial transparency designed for scrutiny, not just display.
                  </h1>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                    A public-safe, audit-friendly platform for MU CSE Society that keeps
                    verified records, approvals, reconciliation, and publication
                    boundaries clear from the first screen.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href="/financial-summaries">
                      Explore published summaries
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/events">View public events</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {landingMetrics.map((metric) => (
                  <Card key={metric.label} className="p-5">
                    <div className="metric-figure">{metric.value}</div>
                    <div className="mt-4 text-sm font-semibold text-foreground">
                      {metric.label}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-muted-foreground">
                      {metric.detail}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <Card tone="contrast" className="overflow-hidden">
                <CardHeader>
                  <Badge className="border-white/10 bg-white/10 text-white" variant="neutral">
                    Publication standard
                  </Badge>
                  <CardTitle className="mt-3 text-2xl">
                    Public release happens only after control closure.
                  </CardTitle>
                  <CardDescription className="text-primary-foreground/75">
                    Finalized reconciliation is the line between internal finance
                    operations and public-safe publication.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                    <div className="data-kicker text-primary-foreground/65">Included publicly</div>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-primary-foreground/85">
                      {disclosureBoundary.publicIncluded.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                    <div className="data-kicker text-primary-foreground/65">Never exposed</div>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-primary-foreground/85">
                      {disclosureBoundary.publicExcluded.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card tone="success">
                <CardHeader>
                  <Badge variant="success">Published snapshot</Badge>
                  <CardTitle className="mt-3">{publishedSummary.title}</CardTitle>
                  <CardDescription>{publishedSummary.note}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-success/15 bg-panel px-4 py-4">
                    <div className="data-kicker">Collected</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {publishedSummary.totals.collected}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-success/15 bg-panel px-4 py-4">
                    <div className="data-kicker">Spent</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {publishedSummary.totals.spent}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-success/15 bg-panel px-4 py-4">
                    <div className="data-kicker">Closing balance</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {publishedSummary.totals.closingBalance}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="section-shell pb-12 sm:pb-16">
          <div className="surface-panel-muted p-6 sm:p-8">
            <div className="data-kicker">Operational cadence</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              {controlCadence.map((item, index) => (
                <div key={item.label} className="relative rounded-[1.2rem] border border-border/70 bg-panel px-4 py-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      0{index + 1}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell pb-12 sm:pb-16 lg:pb-20">
          <div className="grid gap-6 lg:grid-cols-3">
            {trustPillars.map((pillar) => (
              <Card key={pillar.title} className="h-full">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4">{pillar.title}</CardTitle>
                  <CardDescription>{pillar.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="section-shell pb-12 sm:pb-16 lg:pb-20">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border/70 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">Public event layer</Badge>
                  <Badge variant="success">Student-friendly</Badge>
                </div>
                <CardTitle className="mt-3 text-2xl">
                  Operational clarity without internal leakage
                </CardTitle>
                <CardDescription>
                  Public event views expose what students need to act confidently, while
                  the backend keeps payment proofs, reviewer notes, and protected
                  handling out of sight.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                {publicEventCards.map((event) => (
                  <div
                    key={event.slug}
                    className="rounded-[1.25rem] border border-border/70 bg-panel-muted p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">{event.status}</Badge>
                      <Badge
                        variant={event.registrationState === "Open" ? "success" : "warning"}
                      >
                        {event.registrationState}
                      </Badge>
                    </div>
                    <div className="mt-4 text-lg font-semibold text-foreground">
                      {event.title}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{event.dateLabel}</div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {event.description}
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">
                        {event.seatsLabel}
                      </span>
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/events">
                          Explore
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card tone="muted">
              <CardHeader>
                <Badge variant="warning">Protected/internal boundary</Badge>
                <CardTitle className="mt-3 text-2xl">
                  Publication stays deliberately narrow
                </CardTitle>
                <CardDescription>
                  This platform is designed to release trustworthy summaries, not raw
                  internal operations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[1.2rem] border border-border/70 bg-panel px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Eye className="h-5 w-5 text-success" />
                    <div className="text-sm font-semibold text-foreground">
                      Public-safe view
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Summary totals, publish timing, reconciliation status, and
                    high-level breakdowns that students can understand without special
                    context.
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-border/70 bg-panel px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div className="text-sm font-semibold text-foreground">
                      Protected/internal view
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Payment proof metadata, complaint evidence, reviewer identity, and
                    decision notes reserved for authorized roles only.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
