import Link from "next/link";
import { CalendarDays, ShieldCheck, Users, Archive } from "lucide-react";
import { getCurrentUser } from "@/lib/api/student";
import { getMissingEventTeamRoles, isSystemAdmin } from "@/lib/access";
import { apiFetchServer } from "@/lib/api/server";
import { formatEnumLabel, getEventStatusTone } from "@/lib/format";
import type { ManagedEvent } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SystemOverviewPage() {
  const user = await getCurrentUser();
  if (!isSystemAdmin(user)) return null;

  try {
    const { events, pagination } = await apiFetchServer<{ events: ManagedEvent[]; pagination: { totalItems: number } }>(
      "/events/manage/list", { query: { pageSize: "10" } },
    );
    const links = [
      { href: "/dashboard/events", title: "Events and teams", detail: "Create upcoming events, publish drafts, and assign each event its own team.", icon: CalendarDays },
      { href: "/dashboard/users", title: "Accounts and roles", detail: "Manage accounts and global roles. Operational roles are assigned inside each event.", icon: Users },
      { href: "/dashboard/audit", title: "Platform audit", detail: "Review the history of account changes, event decisions, and team assignments.", icon: Archive },
    ];
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Global governance" title="System administration"
          description="Publish upcoming events with separate teams. After publication, each assigned team manages its event's operations." />
        <div className="grid gap-4 xl:grid-cols-3">
          {links.map(({ href, title, detail, icon: Icon }) => (
            <Card key={href}><CardHeader><Icon className="h-6 w-6 text-primary" /><CardTitle>{title}</CardTitle><CardDescription>{detail}</CardDescription></CardHeader>
              <CardContent><Button asChild variant="outline"><Link href={href}>Open {title.toLowerCase()}</Link></Button></CardContent>
            </Card>
          ))}
        </div>
        <Card><CardHeader><CardTitle>Event handoff</CardTitle><CardDescription>{pagination.totalItems} events in the platform. Showing the most recent {events.length}.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? <p className="text-sm text-muted-foreground">Create your first event and assign its Event Admin, Event Manager, Finance Controller, and Approver.</p> : null}
            {events.map((event) => {
              const missingRoles = getMissingEventTeamRoles(event);
              return (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div><div className="font-semibold">{event.title}</div><div className="mt-1 text-sm text-muted-foreground">{missingRoles.length > 0 ? `Assign active personnel: ${missingRoles.map(formatEnumLabel).join(", ")}` : event.status === "DRAFT" ? "Team ready for System Admin publication" : "Operations belong to the assigned event team"}</div></div>
                <div className="flex items-center gap-3"><Badge variant={getEventStatusTone(event.status)}>{formatEnumLabel(event.status)}</Badge><Button asChild size="sm" variant="outline"><Link href={`/dashboard/events?eventId=${event.id}`}>Manage team</Link></Button><Button asChild size="sm" variant="secondary"><Link href={`/dashboard/events/${event.slug}`}>View event</Link></Button></div>
              </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  } catch {
    return <StatePanel icon={ShieldCheck} tone="error" title="Unable to load platform overview" description="Please try reloading the overview shortly." />;
  }
}
