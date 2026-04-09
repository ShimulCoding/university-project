import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, ShieldAlert, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";

import { getPublicEvent } from "@/lib/api/public";
import { ApiError } from "@/lib/api/shared";
import {
  formatDate,
  formatEnumLabel,
  getEventStatusTone,
  getWindowStateTone,
  isRegistrationOpen,
} from "@/lib/format";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

export default async function PublicEventDetailsPage({
  params,
}: {
  params: Promise<{ eventLookup: string }>;
}) {
  const { eventLookup } = await params;

  try {
    const event = await getPublicEvent(eventLookup);

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Public event details"
            title={event.title}
            description={
              event.description ??
              "This event is visible publicly, with registration timing and public-safe status context."
            }
            action={
              <div className="flex flex-wrap gap-3">
                <Badge variant={getEventStatusTone(event.status)}>
                  {formatEnumLabel(event.status)}
                </Badge>
                <Badge variant={getWindowStateTone(event.registrationWindow.state)}>
                  Registration {formatEnumLabel(event.registrationWindow.state)}
                </Badge>
              </div>
            }
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Public-safe event overview</CardTitle>
                <CardDescription>
                  This page shares timing, availability, and public context only. Proof
                  files, participant-private details, and internal review notes stay protected.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Registration opens
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">
                    {formatDate(event.registrationWindow.opensAt)}
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Registration closes
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">
                    {formatDate(event.registrationWindow.closesAt)}
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Event starts
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">
                    {formatDate(event.schedule.startsAt)}
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <UsersRound className="h-4 w-4 text-primary" />
                    Visible availability
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">
                    {event.seatsRemaining === null
                      ? `${event.registeredCount} registrations`
                      : `${event.seatsRemaining} seats remaining`}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card tone="muted">
              <CardHeader>
                <CardTitle className="text-2xl">Next public action</CardTitle>
                <CardDescription>
                  Public visitors can continue into student-owned actions without ever
                  crossing into protected internal workflows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isRegistrationOpen(event) ? (
                  <>
                    <div className="rounded-[1.15rem] border border-success/15 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                      Registration is open. Student access is required before a participant
                      record and payment-proof flow can be created.
                    </div>
                    <Button asChild className="w-full">
                      <Link href={`/events/${event.slug}/register`}>
                        Continue to registration
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <StatePanel
                    icon={ShieldAlert}
                    tone="warning"
                    title="Registration is not open right now"
                    description="This event remains visible publicly, but student registration is currently unavailable."
                  />
                )}
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/complaints/new?eventId=${event.id}`}>Report a concern</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Public event details"
            title="Event details are temporarily unavailable"
            description="The live backend could not return this event right now."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Event details could not be loaded"
              description={
                error instanceof Error
                  ? error.message
                  : "An unexpected error prevented the event from loading."
              }
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
