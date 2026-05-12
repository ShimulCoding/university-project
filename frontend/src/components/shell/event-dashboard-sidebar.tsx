"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import type { AppRole, ManagedEvent, UserProfile } from "@/types";
import { eventDashboardNavigation, roleMeta } from "@/lib/navigation";
import { formatEnumLabel, getEventStatusTone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/shell/app-logo";
import { Badge } from "@/components/ui/badge";

export function EventDashboardSidebar({
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

  // Filter navigation by user's event roles
  const navigation = eventDashboardNavigation.filter((item) =>
    eventRoles.some((role) => item.roles.includes(role)) ||
    eventRoles.includes("SYSTEM_ADMIN" as AppRole),
  );

  const primaryRole = eventRoles[0];
  const primaryRoleMeta = primaryRole ? roleMeta[primaryRole] : null;

  return (
    <aside className="order-2 surface-panel-muted flex h-full flex-col gap-8 p-5 lg:order-none lg:sticky lg:top-6 lg:min-h-[calc(100vh-3rem)]">
      <div className="space-y-5">
        <AppLogo />

        {/* Event Identity Card */}
        <div className="rounded-[1.35rem] border border-primary/10 bg-gradient-to-br from-primary via-primary/95 to-primary/85 px-4 py-4 text-primary-foreground shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div className="data-kicker text-primary-foreground/70">Event workspace</div>
            <Badge
              variant={getEventStatusTone(event.status) as any}
              className="border-white/10 bg-white/10 text-white text-[10px] uppercase tracking-widest"
            >
              {formatEnumLabel(event.status)}
            </Badge>
          </div>
          <div className="mt-3 text-base font-semibold leading-snug">{event.title}</div>
          <div className="mt-1 text-xs text-primary-foreground/60 font-mono">
            {event.slug}
          </div>

          <div className="mt-4 rounded-[1rem] border border-white/10 bg-white/10 px-3 py-3 text-sm text-primary-foreground/85">
            <div className="font-semibold">{user.fullName}</div>
            <div className="mt-1 text-xs text-primary-foreground/70">{user.email}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {eventRoles.map((role) => (
                <Badge
                  key={role}
                  variant="neutral"
                  className="border-white/10 bg-white/10 text-white text-[9px] uppercase tracking-widest px-1.5"
                >
                  {roleMeta[role]?.shortLabel ?? formatEnumLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div>
        <div className="data-kicker">Event modules</div>
        <nav className="mt-4 space-y-2">
          {navigation.map((item) => {
            const fullHref = `${basePath}${item.href}`;
            const active =
              (item.href === "" && pathname === basePath) ||
              (item.href !== "" && pathname.startsWith(fullHref));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={fullHref}
                className={cn(
                  "focus-ring flex items-start gap-3 rounded-[1.15rem] border px-4 py-3 transition-colors",
                  active
                    ? "border-primary/15 bg-panel text-foreground shadow-panel"
                    : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-panel hover:text-foreground",
                )}
              >
                <div className="mt-0.5 rounded-xl border border-border/70 bg-panel p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Quick links */}
      <div className="space-y-3">
        <div className="data-kicker">Quick actions</div>
        <Link
          href="/dashboard/my-events"
          className="focus-ring flex items-center gap-3 rounded-[1.15rem] border border-border/70 bg-panel px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-panel-muted"
        >
          <ArrowLeft className="h-4 w-4 text-primary" />
          Back to My Events
        </Link>
        <Link
          href={`/events/${event.slug}`}
          className="focus-ring flex items-center gap-3 rounded-[1.15rem] border border-border/70 bg-panel px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-panel-muted"
        >
          View public event page
        </Link>
      </div>
    </aside>
  );
}
