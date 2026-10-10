"use client";
import type { AppRole, ManagedEvent, UserProfile } from "@/types";
import { eventDashboardNavigation, roleMeta } from "@/lib/navigation";
import { WorkspaceSidebar } from "@/components/shell/workspace-sidebar";

export function EventDashboardSidebar({
  user,
  event,
  eventRoles,
}: {
  user: UserProfile;
  event: ManagedEvent;
  eventRoles: AppRole[];
}) {
  const admin = eventRoles.includes("SYSTEM_ADMIN");
  const links = eventDashboardNavigation
    .filter(
      (item) => admin || eventRoles.some((role) => item.roles.includes(role)),
    )
    .map((item) => ({
      ...item,
      href: `/dashboard/events/${event.slug}${item.href}`,
    }));
  return (
    <WorkspaceSidebar
      user={user}
      label="Event workspace"
      title={event.title}
      subtitle={
        admin
          ? "Read-only system oversight"
          : eventRoles.map((role) => roleMeta[role].shortLabel).join(" · ")
      }
      links={links}
      backHref={admin ? "/dashboard/events" : "/dashboard/my-events"}
      backLabel={admin ? "Events and teams" : "My event workspaces"}
      publicHref={`/events/${event.slug}`}
    />
  );
}
