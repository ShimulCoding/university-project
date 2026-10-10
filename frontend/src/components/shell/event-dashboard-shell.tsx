"use client";

import type { AppRole, ManagedEvent, UserProfile } from "@/types";
import { EventDashboardHeader } from "@/components/shell/event-dashboard-header";
import { EventDashboardSidebar } from "@/components/shell/event-dashboard-sidebar";

export function EventDashboardShell({
  children,
  user,
  event,
  eventRoles,
}: {
  children: React.ReactNode;
  user: UserProfile;
  event: ManagedEvent;
  eventRoles: AppRole[];
}) {
  return (
    <div className="workspace-frame">
      <EventDashboardSidebar
        user={user}
        event={event}
        eventRoles={eventRoles}
      />
      <div className="workspace-content">
        <EventDashboardHeader
          user={user}
          event={event}
          eventRoles={eventRoles}
        />
        <main id="main-content" tabIndex={-1} className="space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
