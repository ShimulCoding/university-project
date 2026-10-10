import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, CalendarDays, Users } from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { getAssignedEvents, isSystemAdmin } from "@/lib/access";
import { formatEnumLabel, getEventStatusTone } from "@/lib/format";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";
import { LogoutButton } from "@/components/student/logout-button";

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const user = await getCurrentUser();
  if (!user || isSystemAdmin(user)) redirect("/dashboard");
  const assignedEvents = getAssignedEvents(user);

  return (
    <PublicPageShell>
      <main
        id="main-content"
        tabIndex={-1}
        className="section-shell space-y-8 py-8 sm:py-12"
      >
        <PageHeader
          eyebrow="Your internal team"
          title="My Event Workspaces"
          description={`You are assigned to ${assignedEvents.length} event${assignedEvents.length === 1 ? "" : "s"}. Choose an event to open the workspace for your assigned role.`}
          action={<LogoutButton redirectTo="/" />}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-panel px-5 py-4 text-sm">
          <span className="font-semibold">{user.fullName}</span>
          <span className="min-w-0 break-all text-muted-foreground">
            {user.email}
          </span>
          <span className="text-xs text-muted-foreground sm:ml-auto">
            Signed in to your team account
          </span>
        </div>
        {assignedEvents.length === 0 ? (
          <StatePanel
            icon={CalendarDays}
            tone="empty"
            title="No event assignments found"
            description="Contact the System Admin to be added to an event team."
          />
        ) : (
          <section
            aria-label="Your assigned events"
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {assignedEvents.map((event) => (
              <Card
                key={event.id}
                className="flex flex-col transition-colors hover:border-primary/35"
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <CalendarDays
                      className="h-5 w-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Badge variant={getEventStatusTone(event.status)}>
                      {formatEnumLabel(event.status)}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Your responsibilities
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.roles.map((role) => (
                      <Badge key={role} variant="info">
                        {formatEnumLabel(role)}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-5">
                  <Button asChild className="w-full">
                    <Link href={`/dashboard/events/${event.slug}`}>
                      Open Event Workspace
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </section>
        )}
      </main>
    </PublicPageShell>
  );
}
