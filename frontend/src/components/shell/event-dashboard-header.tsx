"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AppRole, ManagedEvent, UserProfile } from "@/types";
import { eventDashboardNavigation, roleMeta } from "@/lib/navigation";
import { formatEnumLabel, getEventStatusTone } from "@/lib/format";
import { InternalSessionCard } from "@/components/internal/internal-session-card";
import { LogoutButton } from "@/components/student/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const eventModuleTitles: Record<string, { title: string; description: string }> = {
  "": {
    title: "Event command surface",
    description:
      "Manage finances, verify submissions, and execute approvals scoped to this specific event.",
  },
  "/payments": {
    title: "Payment verification queue",
    description: "Review payment proofs submitted for this event.",
  },
  "/income-records": {
    title: "Income records",
    description: "Track and verify income sources for this event.",
  },
  "/budgets": {
    title: "Budget management",
    description: "Manage budget versions and line items for this event.",
  },
  "/budget-requests": {
    title: "Budget requests",
    description: "Review and manage funding requests for this event.",
  },
  "/expense-requests": {
    title: "Expense requests",
    description: "Review spending requests for this event.",
  },
  "/expense-records": {
    title: "Expense records",
    description: "Track settled expenses for this event.",
  },
  "/approvals": {
    title: "Approval queue",
    description: "Decision queue for this event's workflows.",
  },
  "/complaints": {
    title: "Complaint review",
    description: "Protected complaint routing for this event.",
  },
  "/reconciliation": {
    title: "Reconciliation workspace",
    description: "Closure reports and verification for this event.",
  },
  "/publications": {
    title: "Publication boundary",
    description: "Public-safe release for this event's financial data.",
  },
};

export function EventDashboardHeader({
  user,
  event,
  eventRoles,
}: {
  user: UserProfile;
  event: ManagedEvent;
  eventRoles: AppRole[];
}) {
  const pathname = usePathname();
  const basePath = `/dashboard/events/${event.slug}`;

  // Determine current module
  const relativePath = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length)
    : "";

  const matchedModule = Object.keys(eventModuleTitles)
    .filter((key) => key !== "")
    .find((key) => relativePath.startsWith(key));

  const current =
    eventModuleTitles[matchedModule ?? ""] ?? eventModuleTitles[""];

  const primaryRole = eventRoles[0];
  const primaryRoleMeta = primaryRole ? roleMeta[primaryRole] : null;

  return (
    <div className="surface-panel flex flex-col gap-6 p-5 md:flex-row md:items-start md:justify-between">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Event workspace</Badge>
          <Badge variant={getEventStatusTone(event.status) as any}>
            {formatEnumLabel(event.status)}
          </Badge>
          {primaryRoleMeta && (
            <Badge variant="success">{primaryRoleMeta.shortLabel}</Badge>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          {current?.title ?? "Event workspace"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          {current?.description ?? "Manage this event's internal workflows."}
        </p>
        <div className="mt-5 rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
          <div className="data-kicker">Event: {event.title}</div>
          {primaryRoleMeta && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {primaryRoleMeta.focus}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-3 md:min-w-[280px]">
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/my-events">My Events</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/events/${event.slug}`}>Public page</Link>
          </Button>
          <LogoutButton redirectTo="/" />
        </div>
        <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-3">
          <Badge variant="info" className="w-fit mb-2">
            Event team member
          </Badge>
          <div className="text-sm font-semibold text-foreground">{user.fullName}</div>
          <div className="text-xs text-muted-foreground mt-1">{user.email}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {eventRoles.map((role) => (
              <Badge key={role} variant="neutral" className="text-[10px]">
                {formatEnumLabel(role)}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
