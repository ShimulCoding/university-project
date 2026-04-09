import Link from "next/link";
import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";

import {
  eventPageSignals,
  publicEventCards,
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
import { PageHeader } from "@/components/ui/page-header";

export default function PublicEventsPage() {
  return (
    <PublicPageShell>
      <main className="section-shell py-12 sm:py-16">
        <PageHeader
          eyebrow="Public events"
          title="Events that stay clear before, during, and after registration"
          description="Students see event timing, registration status, and public-safe financial posture without crossing into protected operational data."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/financial-summaries">Published outcomes</Link>
            </Button>
          }
        />

        <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4 md:grid-cols-3">
            {eventPageSignals.map((signal) => (
              <Card key={signal.label} tone="muted" className="h-full">
                <div className="data-kicker">{signal.label}</div>
                <div className="mt-4 text-3xl font-semibold text-primary">{signal.value}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.detail}</p>
              </Card>
            ))}
          </div>
          <Card className="h-full">
            <CardHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="mt-4 text-xl">Public event views stay deliberately limited</CardTitle>
              <CardDescription>
                The goal is student clarity, not exposure of protected financial evidence
                or reviewer-side workflow detail.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {publicEventCards.map((event) => (
            <Card key={event.slug} className="h-full">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{event.status}</Badge>
                  <Badge variant={event.registrationState === "Open" ? "success" : "warning"}>
                    {event.registrationState}
                  </Badge>
                </div>
                <CardTitle className="mt-4 text-2xl">{event.title}</CardTitle>
                <CardDescription>{event.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3 rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span>{event.dateLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-foreground">{event.seatsLabel}</div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/financial-summaries">
                      View publication posture
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </PublicPageShell>
  );
}
