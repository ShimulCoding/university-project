import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { publicEventCards } from "@/features/foundation/data/demo-content";
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
        />

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
