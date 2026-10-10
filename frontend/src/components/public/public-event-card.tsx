import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  UsersRound,
} from "lucide-react";
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

type StudentEventContext = {
  isSignedIn: boolean;
  registrationByEventId: Record<string, string>;
};
export function PublicEventCard({
  event,
  studentCtx,
}: {
  event: PublicEvent;
  studentCtx?: StudentEventContext | undefined;
}) {
  const registrationId = studentCtx?.registrationByEventId[event.id];
  const open = isRegistrationOpen(event);
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-panel transition-colors hover:border-success/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-panel-muted px-6 py-4">
        <Badge variant={getEventStatusTone(event.status)}>
          {formatEnumLabel(event.status)}
        </Badge>
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {formatDate(event.schedule.startsAt)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getWindowStateTone(event.registrationWindow.state)}>
            Registration {formatEnumLabel(event.registrationWindow.state)}
          </Badge>
        </div>
        <h3 className="mt-4 text-2xl font-semibold leading-snug tracking-tight">
          <Link
            className="focus-ring rounded-lg hover:text-success"
            href={`/events/${event.slug}`}
          >
            {event.title}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">
          {event.description ??
            "Discover the program and check its registration details."}
        </p>
        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              {event.seatsRemaining === null
                ? `${event.registeredCount} registrations`
                : `${event.seatsRemaining} seats remaining`}
            </span>
            <span>
              Window closes {formatDate(event.registrationWindow.closesAt)}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              asChild
              variant={open && !registrationId ? "outline" : "default"}
              size="sm"
            >
              <Link href={`/events/${event.slug}`}>
                View details <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {registrationId ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/registrations/${registrationId}`}>
                  <CheckCircle2 aria-hidden="true" />
                  View my registration
                </Link>
              </Button>
            ) : open ? (
              <Button asChild size="sm">
                <Link href={`/events/${event.slug}/register`}>
                  {studentCtx?.isSignedIn
                    ? "Register now"
                    : "Sign in to register"}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-6 py-2">
        <span className="text-[11px] text-muted-foreground">
          For assigned team members
        </span>
        <Link
          className="focus-ring flex min-h-11 items-center gap-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-success"
          href={`/dashboard/events/${event.slug}`}
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          Event team sign in
        </Link>
      </div>
    </article>
  );
}
