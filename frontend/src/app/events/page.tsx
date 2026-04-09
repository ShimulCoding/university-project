import { AlertTriangle, CalendarRange, ShieldCheck, TicketCheck } from "lucide-react";

import { listPublicEvents } from "@/lib/api/public";
import { ApiError } from "@/lib/api/shared";
import { formatEnumLabel } from "@/lib/format";
import { PublicEventCard } from "@/components/public/public-event-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

export default async function PublicEventsPage() {
  try {
    const events = await listPublicEvents();
    const openEvents = events.filter((event) => event.registrationWindow.state === "OPEN").length;
    const closedEvents = events.filter(
      (event) => event.status === "COMPLETED" || event.status === "CLOSED",
    ).length;
    const totalRegistrations = events.reduce((sum, event) => sum + event.registeredCount, 0);

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Public events"
            title="Events that stay clear before, during, and after registration"
            description="Students see real event timing, registration status, and public-safe operational posture without crossing into protected payment or review data."
          />

          <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4 md:grid-cols-3">
              <Card tone="muted">
                <div className="data-kicker">Open registration flows</div>
                <div className="mt-4 text-3xl font-semibold text-primary">{openEvents}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Public event records currently accepting student registration.
                </p>
              </Card>
              <Card tone="muted">
                <div className="data-kicker">Completed or closed events</div>
                <div className="mt-4 text-3xl font-semibold text-primary">{closedEvents}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Events that have moved beyond active intake toward closure or publication.
                </p>
              </Card>
              <Card tone="muted">
                <div className="data-kicker">Visible registrations</div>
                <div className="mt-4 text-3xl font-semibold text-primary">{totalRegistrations}</div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Public counts only. Student-owned identifiers and proofs remain protected.
                </p>
              </Card>
            </div>
            <Card className="h-full">
              <CardHeader>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="mt-4 text-xl">Public event views stay deliberately limited</CardTitle>
                <CardDescription>
                  This layer is for student clarity and public confidence. Payment proofs,
                  reviewer remarks, and internal operational details remain outside the
                  public surface.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {events.length === 0 ? (
            <div className="mt-10">
              <StatePanel
                icon={CalendarRange}
                tone="empty"
                title="No public events are available right now"
                description="When published event records are available, they will appear here with registration timing and public-safe status context."
              />
            </div>
          ) : (
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {events.map((event) => (
                <PublicEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Unable to load public event data right now.";

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Public events"
            title="Events that stay clear before, during, and after registration"
            description="The event directory depends on the live backend. If it becomes unavailable, the page fails clearly rather than pretending the system is empty."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Public events could not be loaded"
              description={message}
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
