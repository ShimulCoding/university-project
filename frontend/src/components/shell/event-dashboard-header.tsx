"use client";
import Link from "next/link";
import type { AppRole, ManagedEvent, UserProfile } from "@/types";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { roleMeta } from "@/lib/navigation";
import { formatEnumLabel, getEventStatusTone } from "@/lib/format";
import { LogoutButton } from "@/components/student/logout-button";
import { Badge } from "@/components/ui/badge";

export function EventDashboardHeader({
  user,
  event,
  eventRoles,
}: {
  user: UserProfile;
  event: ManagedEvent;
  eventRoles: AppRole[];
}) {
  const admin = eventRoles.includes("SYSTEM_ADMIN");
  return (
    <header className="workspace-context">
      <div className="min-w-0 space-y-2">
        <Link
          href={admin ? "/dashboard/events" : "/dashboard/my-events"}
          className="focus-ring flex w-fit items-center gap-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-success"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {admin ? "All events" : "My Events"}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Event workspace</span>
          <Badge variant={getEventStatusTone(event.status)}>
            {formatEnumLabel(event.status)}
          </Badge>
          {admin ? (
            <Badge variant="info">Read-only system oversight</Badge>
          ) : (
            eventRoles.map((role) => (
              <Badge key={role} variant="success">
                {roleMeta[role].shortLabel}
              </Badge>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="max-w-[160px] truncate text-xs text-muted-foreground"
          title={user.email}
        >
          {user.fullName}
        </span>
        <Link
          className="focus-ring flex min-h-11 items-center gap-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
          href={`/events/${event.slug}`}
        >
          Public page{" "}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <LogoutButton redirectTo="/" />
      </div>
    </header>
  );
}
