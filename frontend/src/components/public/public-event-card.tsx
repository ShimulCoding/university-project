import Link from "next/link";
import { ArrowRight, CalendarDays, UsersRound } from "lucide-react";

import type { PublicEvent } from "@/types";
import {
  formatDate,
  formatEnumLabel,
  getEventStatusTone,
  getWindowStateTone,
  isRegistrationOpen,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PublicEventCard({ event }: { event: PublicEvent }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getEventStatusTone(event.status)}>{formatEnumLabel(event.status)}</Badge>
          <Badge variant={getWindowStateTone(event.registrationWindow.state)}>
            Registration {formatEnumLabel(event.registrationWindow.state)}
          </Badge>
        </div>
        <CardTitle className="mt-4 text-2xl">{event.title}</CardTitle>
        <CardDescription>
          {event.description ?? "No public description is available for this event yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              Event date
            </div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">
              {formatDate(event.schedule.startsAt)}
            </div>
          </div>
          <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UsersRound className="h-4 w-4 text-primary" />
              Availability
            </div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">
              {event.seatsRemaining === null
                ? `${event.registeredCount} registrations`
                : `${event.seatsRemaining} seats remaining`}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Window closes {formatDate(event.registrationWindow.closesAt)}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/events/${event.slug}`}>View details</Link>
            </Button>
            {isRegistrationOpen(event) ? (
              <Button asChild size="sm">
                <Link href={`/events/${event.slug}/register`}>
                  Register now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
