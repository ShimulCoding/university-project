import { AlertTriangle, CalendarRange, Users, Sparkles, History } from "lucide-react";

import { listPublicEvents } from "@/lib/api/public";
import { getCurrentUser, listMyRegistrations } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
import { PublicEventCard } from "@/components/public/public-event-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

export default async function PublicEventsPage() {
  try {
    const [events, user] = await Promise.all([listPublicEvents(), getCurrentUser()]);
    const myRegistrations = user ? await listMyRegistrations() : [];

    // Build a lookup map: event ID → registration ID
    const registrationByEventId: Record<string, string> = {};
    for (const reg of myRegistrations) {
      registrationByEventId[reg.event.id] = reg.id;
    }

    const studentCtx = user
      ? { isSignedIn: true, registrationByEventId }
      : undefined;

    const openEvents = events.filter((event) => event.registrationWindow.state === "OPEN").length;
    const closedEvents = events.filter(
      (event) => event.status === "COMPLETED" || event.status === "CLOSED",
    ).length;
    const totalRegistrations = events.reduce((sum, event) => sum + event.registeredCount, 0);

    return (
      <PublicPageShell>
        <main className="flex flex-col min-h-screen bg-background selection:bg-primary/20">
          
          {/* HERO HEADER */}
          <section className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-20 section-shell border-b border-border/10">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute top-0 right-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-primary/10 opacity-60 blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
            
            <div className="relative z-10 max-w-4xl space-y-6">
              <Badge variant="neutral" className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase shadow-sm border-primary/20 bg-primary/5 text-primary backdrop-blur-md">
                Initiatives & Activities
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground text-balance">
                Explore <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/80 to-primary/50">Events</span>
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed font-light">
                Discover upcoming workshops, symposiums, and activities hosted by the MU CSE Society. Register seamlessly and track your participation.
              </p>
            </div>
          </section>

          <section className="section-shell py-12 relative z-20">
            {/* METRICS */}
            <div className="grid gap-6 md:grid-cols-3 mb-16">
              <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Active Enrollments</CardDescription>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-foreground tracking-tight">{openEvents}</div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                    Initiatives currently accepting registrations.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Past Events</CardDescription>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <History className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-foreground tracking-tight">{closedEvents}</div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                    Successfully concluded programs.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Total Participants</CardDescription>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Users className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-foreground tracking-tight">{totalRegistrations}</div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                    Students engaged across all events.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* EVENT LISTING */}
            {events.length === 0 ? (
              <Card className="border-dashed border-border/50 bg-muted/10 rounded-3xl">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <CalendarRange className="h-16 w-16 text-muted-foreground/30 mb-6" />
                  <p className="text-2xl font-bold text-foreground tracking-tight">No active events</p>
                  <p className="text-muted-foreground font-light mt-3 max-w-md">
                    There are no public events available right now. Please check back later for upcoming activities.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-8 lg:grid-cols-2">
                {events.map((event) => (
                  <PublicEventCard key={event.id} event={event} studentCtx={studentCtx} />
                ))}
              </div>
            )}
          </section>
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Unable to load public event data right now.";

    return (
      <PublicPageShell>
        <main className="flex flex-col min-h-screen bg-background">
          <section className="relative overflow-hidden pt-24 pb-16 section-shell">
            <div className="relative z-10 max-w-4xl space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground text-balance">
                Explore Events
              </h1>
            </div>
          </section>
          
          <section className="section-shell py-12">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="System Temporarily Unavailable"
              description={message}
            />
          </section>
        </main>
      </PublicPageShell>
    );
  }
}
