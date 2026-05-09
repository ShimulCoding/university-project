import Link from "next/link";
import { CalendarDays, SearchSlash, ShieldAlert, Clock, Users, CalendarRange, Layers } from "lucide-react";

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
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-info/10 opacity-60 blur-[100px] pointer-events-none -translate-x-1/4 translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3">
              <Badge variant="info" className="px-3 py-1 font-semibold tracking-wider uppercase border-info/30 bg-info/10 text-info backdrop-blur-md">
                <Layers className="w-3 h-3 mr-1.5 inline-block" />
                Initiative Lifecycle
              </Badge>
              {canManageEvents ? (
                <Badge variant="success" className="px-3 py-1 font-semibold tracking-wider uppercase border-success/30 bg-success/10 text-success backdrop-blur-md">
                  Full Control
                </Badge>
              ) : (
                <Badge variant="neutral" className="px-3 py-1 font-semibold tracking-wider uppercase border-border/30 bg-muted/10 text-muted-foreground backdrop-blur-md">
                  Read-Only Access
                </Badge>
              )}
            </div>
            
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              Event <span className="text-transparent bg-clip-text bg-gradient-to-br from-info via-info/80 to-info/50">Operations</span>
            </h1>
            
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              Orchestrate the full initiative lifecycle — from draft creation through public registration, execution, reconciliation, and archival closure.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="neutral" className="bg-background/50 backdrop-blur-sm border-border/50 text-sm py-1.5">
                <CalendarRange className="w-4 h-4 mr-2 inline-block text-info" />
                {events.length} Managed initiative(s)
              </Badge>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/events">
          <Field label="Query Initiative">
            <Input name="search" defaultValue={search ?? ""} placeholder="Search by title or slug..." />
          </Field>
          <Field label="Lifecycle Stage">
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
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_460px] items-start">
          
          {/* EVENTS TABLE */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Initiative Registry</CardTitle>
              <CardDescription>Select an initiative to inspect its lifecycle position, registration window, and capacity allocation.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {events.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    tone="empty"
                    title="No Matching Initiatives"
                    description="No events match the current filter criteria. Create a new initiative draft to begin the lifecycle process."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Initiative</TableHead>
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
                            <Badge variant={getEventStatusTone(event.status)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
                              {formatEnumLabel(event.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getWindowStateTone(event.registrationWindow.state)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
                              {formatEnumLabel(event.registrationWindow.state)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold">{event.registeredCount}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* DETAIL PANEL */}
          <div id="details-panel" className="space-y-6">
            {selectedEvent ? (
              <Card className="border-primary/20 shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                  <CalendarDays className="w-40 h-40" />
                </div>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={getEventStatusTone(selectedEvent.status)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                      {formatEnumLabel(selectedEvent.status)}
                    </Badge>
                    <Badge variant={getWindowStateTone(selectedEvent.registrationWindow.state)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                      Registration {formatEnumLabel(selectedEvent.registrationWindow.state)}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl tracking-tight">{selectedEvent.title}</CardTitle>
                  <CardDescription className="text-muted-foreground font-light">
                    Lifecycle inspector and temporal configuration overview.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-5">
                  <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                      <Clock className="h-3 w-3" /> Event Schedule
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground font-medium">Starts</span>
                        <span className="font-mono text-foreground">{formatDateTime(selectedEvent.schedule.startsAt)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground font-medium">Ends</span>
                        <span className="font-mono text-foreground">{formatDateTime(selectedEvent.schedule.endsAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                      <CalendarRange className="h-3 w-3" /> Registration Window
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground font-medium">Opens</span>
                        <span className="font-mono text-foreground">{formatDateTime(selectedEvent.registrationWindow.opensAt)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground font-medium">Closes</span>
                        <span className="font-mono text-foreground">{formatDateTime(selectedEvent.registrationWindow.closesAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm text-center">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Capacity</div>
                      <div className="text-2xl font-black text-foreground">{selectedEvent.capacity ?? "∞"}</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm text-center">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Seats Left</div>
                      <div className="text-2xl font-black text-foreground">{selectedEvent.seatsRemaining ?? "∞"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {canManageEvents && selectedEvent ? <EventStatusControl event={selectedEvent} /> : null}

            {canManageEvents ? (
              <EventCreateForm />
            ) : (
              <Card className="border-border/40 bg-background/50 backdrop-blur-xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                  <ShieldAlert className="w-24 h-24" />
                </div>
                <CardHeader>
                  <Badge variant="warning" className="w-fit mb-3 text-xs uppercase tracking-widest px-2 py-1">Restricted</Badge>
                  <CardTitle className="text-xl tracking-tight">Observer Mode</CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    Your current role permits inspection of event readiness, but lifecycle transitions and initiative creation require Event Management or System Administrator privileges.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="flex flex-col gap-8 pt-4">
        <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-xl px-8 py-10">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Event Operations</h1>
        </section>
        <StatePanel
          icon={ShieldAlert}
          tone="error"
          title="System Sync Error"
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
