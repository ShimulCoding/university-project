import type { RegistrationRecord } from "@/types";
import {
  CalendarRange,
  Users,
  Sparkles,
  History,
  AlertTriangle,
} from "lucide-react";
import { ListPagination } from "@/components/ui/list-pagination";
import { queryPage, apiOptions } from "@/lib/api/list";
import { listPublicEvents } from "@/lib/api/public";
import { getCurrentUser } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
import { PublicEventCard } from "@/components/public/public-event-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatePanel } from "@/components/ui/state-panel";
import { FilterCard } from "@/components/internal/filter-card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";
const statuses = [
  "PUBLISHED",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
];

export default async function PublicEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search =
    typeof params.search === "string"
      ? params.search.trim().slice(0, 200) || undefined
      : undefined;
  const status =
    typeof params.status === "string" && statuses.includes(params.status)
      ? params.status
      : undefined;
  try {
    const [events, user] = await Promise.all([
      listPublicEvents({
        page: queryPage(params.page),
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      }),
      getCurrentUser(),
    ]);
    const registrations = user
      ? await apiOptions<RegistrationRecord>(
          "/registrations/me",
          "registrations",
        )
      : [];
    const registrationByEventId: Record<string, string> = {};
    for (const registration of registrations)
      registrationByEventId[registration.event.id] = registration.id;
    const studentCtx = user
      ? { isSignedIn: true, registrationByEventId }
      : undefined;
    return (
      <PublicPageShell>
        <main
          id="main-content"
          tabIndex={-1}
          className="section-shell py-10 sm:py-14"
        >
          <PageHeader
            eyebrow="The society calendar"
            title="Explore events."
            description="Find workshops, competitions, and experiences for the MU CSE community. Your next chapter starts here."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Open registrations on this page"
              value={
                events.filter(
                  (event) => event.registrationWindow.state === "OPEN",
                ).length
              }
              detail="Listed events accepting participants"
              icon={Sparkles}
            />
            <MetricCard
              label="Closed registration windows on this page"
              value={
                events.filter(
                  (event) => event.registrationWindow.state === "CLOSED",
                ).length
              }
              detail="Based on the actual registration window"
              icon={History}
            />
            <MetricCard
              label="Registrations on this page"
              value={events.reduce(
                (sum, event) => sum + event.registeredCount,
                0,
              )}
              detail="Participants across the listed events"
              icon={Users}
            />
          </div>
          <div className="mt-8">
            <FilterCard resetHref="/events">
              <Field label="Find an event">
                <Input
                  name="search"
                  type="search"
                  defaultValue={search ?? ""}
                  maxLength={200}
                  placeholder="Search by event name…"
                />
              </Field>
              <Field label="Event status">
                <Select
                  name="status"
                  defaultValue={status ?? ""}
                  options={[
                    { value: "", label: "All public events" },
                    { value: "PUBLISHED", label: "Published" },
                    {
                      value: "REGISTRATION_CLOSED",
                      label: "Registration closed",
                    },
                    { value: "IN_PROGRESS", label: "In progress" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "CLOSED", label: "Closed" },
                  ]}
                />
              </Field>
            </FilterCard>
          </div>
          <div className="mt-8 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">
              {search || status ? "Matching events" : "The event directory"}
            </h2>
            <span className="text-xs text-muted-foreground">
              {events.pagination.totalItems} results
            </span>
          </div>
          <div className="mt-5">
            {events.length ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {events.map((event) => (
                  <PublicEventCard
                    key={event.id}
                    event={event}
                    studentCtx={studentCtx}
                  />
                ))}
              </div>
            ) : (
              <StatePanel
                icon={CalendarRange}
                title={
                  search || status
                    ? "No matching events"
                    : "The next experience is on its way"
                }
                description={
                  search || status
                    ? "Try a different event name or reset the filters to browse all events."
                    : "New society events will appear here after they are published."
                }
              />
            )}
          </div>
          <ListPagination pagination={events.pagination} />
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    return (
      <PublicPageShell>
        <main
          id="main-content"
          tabIndex={-1}
          className="section-shell space-y-8 py-12"
        >
          <PageHeader
            eyebrow="The society calendar"
            title="Explore events."
            description="Find your next society experience."
          />
          <StatePanel
            icon={AlertTriangle}
            tone="error"
            title="Events are temporarily unavailable"
            description={
              error instanceof ApiError
                ? error.message
                : "Please try loading the directory again shortly."
            }
          />
        </main>
      </PublicPageShell>
    );
  }
}
