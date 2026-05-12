import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  ShieldCheck,
  Users,
  Layers,
  ArrowRight,
} from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { getAssignedEvents, isSystemAdmin } from "@/lib/access";
import { formatEnumLabel, getEventStatusTone } from "@/lib/format";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { InternalSessionCard } from "@/components/internal/internal-session-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { LogoutButton } from "@/components/student/logout-button";

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/dashboard");
  }

  // System admins can go to global dashboard
  if (isSystemAdmin(user)) {
    redirect("/dashboard");
  }

  const assignedEvents = getAssignedEvents(user);

  return (
    <PublicPageShell>
      <main className="flex flex-col min-h-screen bg-background">
        {/* HERO */}
        <section className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-20 border-b border-border/40 bg-card/30">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-primary/10 opacity-60 blur-[120px]" />

          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6 px-4">
            <Badge
              variant="neutral"
              className="px-5 py-2 text-sm font-semibold tracking-widest uppercase shadow-sm border-primary/20 bg-primary/5 text-primary backdrop-blur-md"
            >
              <ShieldCheck className="w-4 h-4 mr-2 inline-block" />
              Authenticated Session
            </Badge>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
              My{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/90 to-primary/60">
                Event Workspaces
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed font-medium">
              You are assigned to {assignedEvents.length} event
              {assignedEvents.length !== 1 ? "s" : ""}. Select an event below to
              access its internal workspace and manage finance, approvals,
              complaints, and reconciliation.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Badge variant="info" className="text-xs">
                {user.fullName}
              </Badge>
              <Badge variant="neutral" className="text-xs font-mono">
                {user.email}
              </Badge>
              <LogoutButton redirectTo="/" />
            </div>
          </div>
        </section>

        {/* EVENTS GRID */}
        <section className="relative z-20 py-16 px-4 md:px-8 max-w-6xl mx-auto w-full">
          {assignedEvents.length === 0 ? (
            <StatePanel
              icon={CalendarDays}
              tone="empty"
              title="No event assignments found"
              description="You have not been assigned to any events yet. Contact the System Administrator to be added to an event team."
            />
          ) : (
            <div className="grid gap-8 md:grid-cols-2">
              {assignedEvents.map((event) => (
                <Card
                  key={event.id}
                  className="group relative overflow-hidden border-border/50 bg-background/60 backdrop-blur-md hover:border-primary/40 transition-all shadow-lg hover:shadow-2xl hover:shadow-primary/10 rounded-3xl"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
                    <Layers className="w-32 h-32" />
                  </div>

                  <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge
                        variant={getEventStatusTone(event.status as any)}
                        className="text-xs tracking-widest font-semibold uppercase px-3 py-1"
                      >
                        {formatEnumLabel(event.status)}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl font-extrabold tracking-tight group-hover:text-primary transition-colors">
                      {event.title}
                    </CardTitle>
                    <CardDescription className="mt-2 text-muted-foreground font-medium">
                      Event-specific internal workspace
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                        <Users className="h-3 w-3" />
                        Your Roles
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {event.roles.map((role) => (
                          <Badge
                            key={role}
                            variant="info"
                            className="text-[10px] tracking-wider uppercase border-info/30 bg-info/10"
                          >
                            {formatEnumLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-2 pb-6 px-6">
                    <Button
                      asChild
                      className="w-full rounded-full shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 h-14 text-base font-bold"
                    >
                      <Link href={`/dashboard/events/${event.slug}`}>
                        Open Event Workspace
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </PublicPageShell>
  );
}
