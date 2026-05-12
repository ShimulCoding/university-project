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
    <div className="section-shell py-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <EventDashboardSidebar user={user} event={event} eventRoles={eventRoles} />
        <div className="order-1 min-w-0 space-y-6 lg:order-none">
          <EventDashboardHeader user={user} event={event} eventRoles={eventRoles} />
          <main className="space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
