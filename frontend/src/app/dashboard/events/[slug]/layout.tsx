import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/api/student";
import { getEventRolesForEvent, hasEventAccess, isSystemAdmin } from "@/lib/access";
import { apiFetchServer } from "@/lib/api/server";
import type { AppRole, ManagedEvent } from "@/types";
import { EventDashboardShell } from "@/components/shell/event-dashboard-shell";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";
import { ShieldAlert } from "lucide-react";

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

  if (!user) {
    redirect(`/dashboard`);
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
