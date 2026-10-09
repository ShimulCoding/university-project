import { getCurrentUser } from "@/lib/api/student";
import { getEventRolesForEvent, hasEventAccess, isSystemAdmin } from "@/lib/access";
import { apiFetchServer } from "@/lib/api/server";
import type { AppRole, ManagedEvent } from "@/types";
import { EventDashboardShell } from "@/components/shell/event-dashboard-shell";
import { EventTeamAccessPanel } from "@/components/internal/event-team-access-panel";
import { LogoutButton } from "@/components/student/logout-button";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getEventBySlug(slug: string) {
  try {
    const response = await apiFetchServer<{ event: ManagedEvent }>(
      `/events/manage/${slug}`,
    );
    return response.event;
  } catch {
    return null;
  }
}

export default async function EventWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();

  const assignedToLookup = user?.eventRoles.some(
    (assignment) => assignment.event.slug === slug || assignment.eventId === slug,
  );

  if (!user || (!isSystemAdmin(user) && !assignedToLookup)) {
    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Event workspace"
            title="Sign in to this event's internal workspace"
            description="Access is granted only when your active account has a team assignment for this exact event."
          />
          <div className="mt-8">
            {user ? (
              <div className="mb-6 rounded-2xl border border-border p-5 text-sm">
                <p>You are signed in as {user.fullName} ({user.email}). This account has no active team assignment for this event. Sign in below with an assigned account.</p>
                <Link className="mt-3 inline-block font-semibold text-primary" href="/dashboard/my-events">View my assigned events</Link>
              </div>
            ) : null}
            <EventTeamAccessPanel eventLookupKey={slug} />
          </div>
        </main>
      </PublicPageShell>
    );
  }

  const event = await getEventBySlug(slug);

  if (!event) {
    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Event workspace"
            title="Event not found"
            description="The requested event could not be found or you do not have access to view it."
          />
          <div className="mt-8">
            <StatePanel
              icon={ShieldAlert}
              tone="error"
              title="Unable to load event workspace"
              description="Verify the event URL or contact the System Administrator if you believe you should have access."
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }

  // Check event-scoped access
  if (!isSystemAdmin(user) && !hasEventAccess(user, event.id)) {
    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Access denied"
            title="You are not assigned to this event"
            description={`You do not have a team assignment for "${event.title}". Contact the System Administrator to be added to this event's team.`}
          />
          <div className="mt-8">
            <StatePanel
              icon={ShieldAlert}
              tone="warning"
              title="No event team assignment found"
              description="Your account is authenticated but you are not listed as a team member for this specific event."
            />
            <div className="mt-4">
              <LogoutButton redirectTo={`/dashboard/events/${slug}`} />
            </div>
          </div>
        </main>
      </PublicPageShell>
    );
  }

  const eventRoles: AppRole[] = isSystemAdmin(user)
    ? ["SYSTEM_ADMIN"]
    : getEventRolesForEvent(user, event.id);

  return (
    <EventDashboardShell user={user} event={event} eventRoles={eventRoles}>
      {children}
    </EventDashboardShell>
  );
}
