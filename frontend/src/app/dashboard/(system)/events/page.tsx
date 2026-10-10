import Link from "next/link";
import { CalendarDays, SearchSlash, ShieldAlert, Clock, CalendarRange, Layers } from "lucide-react";

import { isSystemAdmin } from "@/lib/access";
import { apiFetchServer } from "@/lib/api/server";
import type { ManagedEvent } from "@/types";
import { getCurrentUser } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
import { buildRelativeHref } from "@/lib/detail-query";
import {
  formatDateTime,
  formatEnumLabel,
  getEventStatusTone,
  getWindowStateTone,
} from "@/lib/format";
import {
  EventCreateForm,
  EventStatusControl,
  EventTeamManagement,
} from "@/components/internal/events-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  const page = typeof params.page === "string" && /^[1-9]\d*$/.test(params.page) ? params.page : "1";
  const user = await getCurrentUser();
  if (!isSystemAdmin(user)) return null;

  try {
    const { events, pagination } = await apiFetchServer<{ events: ManagedEvent[]; pagination: { totalPages: number; totalItems: number } }>("/events/manage/list", {
      query: { status, search, page, pageSize: "20" },
    });
    const canCreateEvents = true;
    const selectedEvent = eventId
      ? events.find((event) => event.id === eventId) ?? (await apiFetchServer<{ event: ManagedEvent }>(`/events/manage/${encodeURIComponent(eventId)}`)).event
      : events[0] ?? null;

    return (
      <div className="flex flex-col gap-6 pb-8">
        {/* HERO SECTION */}
        <section className="workspace-intro">



          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3">
              <Badge variant="info" className="px-3 py-1 font-semibold border-info/30 bg-info/10 text-info">
                <Layers className="w-3 h-3 mr-1.5 inline-block" />
                Events and teams
              </Badge>
              {canCreateEvents ? (
                <Badge variant="success" className="px-3 py-1 font-semibold border-success/30 bg-success/10 text-success">
                  Setup Control
                </Badge>
              ) : (
                <Badge variant="neutral" className="px-3 py-1 font-semibold border-border/30 bg-muted/10 text-muted-foreground">
                  Read-Only Access
                </Badge>
              )}
            </div>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground lg:text-4xl">
              Event <span className="text-success">Setup and Teams</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed font-normal">
              Create upcoming events, assign their teams, and publish when ready. Assigned personnel manage each published event from its own workspace.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="neutral" className="bg-panel border-border/50 text-sm py-1.5">
                <CalendarRange className="w-4 h-4 mr-2 inline-block text-info" />
                {pagination.totalItems} events in the platform
              </Badge>
              <Button asChild size="sm"><a href="#create-event">Create new event</a></Button>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/events">
          <Field label="Search events">
            <Input name="search" defaultValue={search ?? ""} placeholder="Search by title or slug..." />
          </Field>
          <Field label="Event status">
            <Select
              name="status"
              defaultValue={status ?? ""}
              options={[
                { value: "", label: "All Stages" },
                { value: "DRAFT", label: "Draft" },
                { value: "PUBLISHED", label: "Published" },
                { value: "REGISTRATION_CLOSED", label: "Registration Closed" },
                { value: "IN_PROGRESS", label: "In Progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "CLOSED", label: "Closed" },
                { value: "ARCHIVED", label: "Archived" },
              ]}
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] items-start">

          {/* EVENTS TABLE */}
          <Card className="border-border/40 shadow-panel bg-panel overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Event directory</CardTitle>
              <CardDescription>Select an event to review its status, registration window, capacity and team.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {events.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    tone="empty"
                    title="No Matching Events"
                    description="Try different filters or create a new event draft."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Event</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Stage</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Enrollment</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Participants</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => {
                      const isSelected = event.id === selectedEvent?.id;
                      return (
                        <TableRow
                          key={event.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/events", params, { eventId: event.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {event.title}
                            </Link>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground tracking-widest bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                              {event.slug}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEventStatusTone(event.status)} className="text-xs px-2 py-0.5">
                              {formatEnumLabel(event.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getWindowStateTone(event.registrationWindow.state)} className="text-xs px-2 py-0.5">
                              {formatEnumLabel(event.registrationWindow.state)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono font-semibold">{event.registeredCount}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                <span className="text-sm text-muted-foreground">Page {page} of {Math.max(1, pagination.totalPages)}</span>
                <div className="flex gap-2">
                  {Number(page) > 1 ? <Button asChild size="sm" variant="outline"><Link href={buildRelativeHref("/dashboard/events", params, { page: String(Number(page) - 1), eventId: undefined })}>Previous</Link></Button> : null}
                  {Number(page) < pagination.totalPages ? <Button asChild size="sm" variant="outline"><Link href={buildRelativeHref("/dashboard/events", params, { page: String(Number(page) + 1), eventId: undefined })}>Next</Link></Button> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DETAIL PANEL */}
          <div id="details-panel" className="space-y-6">
            {selectedEvent ? (
              <Card className="border-primary/20 shadow-panel bg-panel relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                  <CalendarDays className="w-40 h-40" />
                </div>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={getEventStatusTone(selectedEvent.status)} className="text-xs px-2 py-1 shadow-sm">
                      {formatEnumLabel(selectedEvent.status)}
                    </Badge>
                    <Badge variant={getWindowStateTone(selectedEvent.registrationWindow.state)} className="text-xs px-2 py-1 shadow-sm">
                      Registration {formatEnumLabel(selectedEvent.registrationWindow.state)}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl tracking-tight">{selectedEvent.title}</CardTitle>
                  <CardDescription className="text-muted-foreground font-normal">
                    Event dates, registration availability and capacity.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="rounded-xl border border-border/50 bg-panel p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                      <Clock className="h-3 w-3" /> Event Schedule
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-border/30">
                        <span className="text-muted-foreground font-medium">Starts</span>
                        <span className="font-mono text-foreground">{formatDateTime(selectedEvent.schedule.startsAt)}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                        <span className="text-muted-foreground font-medium">Ends</span>
                        <span className="font-mono text-foreground">{formatDateTime(selectedEvent.schedule.endsAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-panel p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                      <CalendarRange className="h-3 w-3" /> Registration Window
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-border/30">
                        <span className="text-muted-foreground font-medium">Opens</span>
                        <span className="font-mono text-foreground">{formatDateTime(selectedEvent.registrationWindow.opensAt)}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                        <span className="text-muted-foreground font-medium">Closes</span>
                        <span className="font-mono text-foreground">{formatDateTime(selectedEvent.registrationWindow.closesAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm text-center">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Capacity</div>
                      <div className="text-2xl font-semibold text-foreground">{selectedEvent.capacity ?? "∞"}</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm text-center">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Seats Left</div>
                      <div className="text-2xl font-semibold text-foreground">{selectedEvent.seatsRemaining ?? "∞"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {canCreateEvents && selectedEvent?.status === "DRAFT" ? (
              <EventStatusControl
                key={selectedEvent.id + selectedEvent.status}
                event={selectedEvent}
                allowedStatuses={["PUBLISHED", "ARCHIVED"]}
              />
            ) : null}

            {canCreateEvents && selectedEvent ? (
              <EventTeamManagement key={selectedEvent.id} event={selectedEvent} />
            ) : null}


          </div>
        </div>
        <section id="create-event"><EventCreateForm /></section>
      </div>
    );
  } catch (error) {
    return (
      <div className="flex flex-col gap-6 pt-4">
        <section className="workspace-intro">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground lg:text-4xl">Event Setup and Teams</h1>
        </section>
        <StatePanel
          icon={ShieldAlert}
          tone="error"
          title="Unable to load this page"
          description={
            error instanceof ApiError
              ? error.message
              : "An unexpected error prevented event operations from loading."
          }
        />
      </div>
    );
  }
}
