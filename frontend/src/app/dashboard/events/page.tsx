import Link from "next/link";
import { CalendarDays, SearchSlash, ShieldAlert } from "lucide-react";

import { hasAnyRole } from "@/lib/access";
import { listManagedEvents } from "@/lib/api/internal";
import { getCurrentUser } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
import { buildRelativeHref } from "@/lib/detail-query";
import {
  formatDateTime,
  formatEnumLabel,
  getEventStatusTone,
  getWindowStateTone,
} from "@/lib/format";
import { EventCreateForm, EventStatusControl } from "@/components/internal/events-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatePanel } from "@/components/ui/state-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DashboardEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;

  try {
    const [user, events] = await Promise.all([
      getCurrentUser(),
      listManagedEvents({ status, search }),
    ]);
    const canManageEvents = hasAnyRole(user, ["SYSTEM_ADMIN", "EVENT_MANAGEMENT_USER"]);
    const selectedEvent = events.find((event) => event.id === eventId) ?? events[0] ?? null;

    return (
      <>
        <PageHeader
          eyebrow="Event operations"
          title="Create, launch, complete, and close event records"
          description="This page is the starting point for the full transparency workflow: create an event, launch public registration, complete the event, then reconcile and publish the summary."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{events.length} visible event(s)</Badge>
              {canManageEvents ? (
                <Badge variant="success">Creation enabled</Badge>
              ) : (
                <Badge variant="neutral">Read-only event view</Badge>
              )}
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/events">
          <Field label="Search">
            <Input name="search" defaultValue={search ?? ""} placeholder="Event title or slug" />
          </Field>
          <Field label="Status">
            <Select
              name="status"
              defaultValue={status ?? ""}
              options={[
                { value: "", label: "All statuses" },
                { value: "DRAFT", label: "Draft" },
                { value: "PUBLISHED", label: "Published" },
                { value: "REGISTRATION_CLOSED", label: "Registration closed" },
                { value: "IN_PROGRESS", label: "In progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "CLOSED", label: "Closed" },
                { value: "ARCHIVED", label: "Archived" },
              ]}
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_440px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Managed events</CardTitle>
              <CardDescription>
                Select an event to inspect its registration window and lifecycle state.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {events.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  tone="empty"
                  title="No events match this filter set"
                  description="Create an event draft first, then publish it when the registration window is ready."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Registered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow
                        key={event.id}
                        data-state={event.id === selectedEvent?.id ? "selected" : undefined}
                      >
                        <TableCell className="align-top">
                          <Link
                            href={buildRelativeHref("/dashboard/events", params, {
                              eventId: event.id,
                            })}
                            className={
                              event.id === selectedEvent?.id
                                ? "focus-ring rounded-sm font-semibold text-primary"
                                : "focus-ring rounded-sm font-semibold text-foreground hover:text-primary hover:underline"
                            }
                            aria-current={event.id === selectedEvent?.id ? "page" : undefined}
                          >
                            {event.title}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">{event.slug}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getEventStatusTone(event.status)}>
                            {formatEnumLabel(event.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getWindowStateTone(event.registrationWindow.state)}>
                            {formatEnumLabel(event.registrationWindow.state)}
                          </Badge>
                        </TableCell>
                        <TableCell>{event.registeredCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedEvent ? (
              <Card>
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">{selectedEvent.title}</CardTitle>
                  <CardDescription>
                    Current lifecycle position and registration timing for this event.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getEventStatusTone(selectedEvent.status)}>
                      {formatEnumLabel(selectedEvent.status)}
                    </Badge>
                    <Badge variant={getWindowStateTone(selectedEvent.registrationWindow.state)}>
                      Registration {formatEnumLabel(selectedEvent.registrationWindow.state)}
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                      <div className="data-kicker">Schedule</div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        Starts {formatDateTime(selectedEvent.schedule.startsAt)}
                        <br />
                        Ends {formatDateTime(selectedEvent.schedule.endsAt)}
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4">
                      <div className="data-kicker">Registration window</div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        Opens {formatDateTime(selectedEvent.registrationWindow.opensAt)}
                        <br />
                        Closes {formatDateTime(selectedEvent.registrationWindow.closesAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm leading-6 text-muted-foreground">
                    Capacity: {selectedEvent.capacity ?? "Unlimited"} | Seats remaining:{" "}
                    {selectedEvent.seatsRemaining ?? "Not limited"}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {canManageEvents && selectedEvent ? <EventStatusControl event={selectedEvent} /> : null}

            {canManageEvents ? (
              <EventCreateForm />
            ) : (
              <Card tone="muted">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-warning/15 bg-warning-muted text-warning-foreground">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Read-only event access</CardTitle>
                  <CardDescription>
                    Finance and approver roles can inspect event readiness here, but only system
                    admins and event managers can create or change event lifecycle status.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeader
          eyebrow="Event operations"
          title="Events could not be loaded"
          description="This page depends on protected event management access from the backend."
        />
        <StatePanel
          icon={ShieldAlert}
          tone="error"
          title="Event operations are unavailable"
          description={
            error instanceof ApiError
              ? error.message
              : "An unexpected error prevented event operations from loading."
          }
        />
      </>
    );
  }
}
