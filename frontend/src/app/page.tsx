import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  BarChart3,
  LockKeyhole,
  Activity,
  Calendar,
  ChevronRight,
} from "lucide-react";

import { listPublicEvents, listPublicFinancialSummaries } from "@/lib/api/public";
import { formatMoney } from "@/lib/format";
import { getLatestPublishedSummariesPerEvent } from "@/lib/public-summary";
import type { PublicEvent } from "@/types";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function getLandingData() {
  try {
    const [events, publishedSnapshots] = await Promise.all([
      listPublicEvents(),
      listPublicFinancialSummaries(),
    ]);
    const latestPublishedSummaries = getLatestPublishedSummariesPerEvent(publishedSnapshots);
    const latestSummary = latestPublishedSummaries[0] ?? null;

    return {
      events,
      metrics: [
        {
          label: "Published Summaries",
          value: String(latestPublishedSummaries.length),
          detail: "Officially reconciled and published financial records.",
          icon: BarChart3,
        },
        {
          label: "Active Events",
          value: String(events.length),
          detail: "Live events currently managed through the platform.",
          icon: Activity,
        },
        {
          label: "Open Registrations",
          value: String(
            events.filter((event) => event.registrationWindow.state === "OPEN").length,
          ),
          detail: "Events currently accepting student registrations.",
          icon: Calendar,
        },
        {
          label: "Latest Collection",
          value: latestSummary ? formatMoney(latestSummary.totals.collected) : "N/A",
          detail: latestSummary
            ? `Verified collection for ${latestSummary.event.title}.`
            : "No verified collections published yet.",
          icon: ShieldCheck,
        },
      ],
      latestSummary,
    };
  } catch {
    return {
      events: [] as PublicEvent[],
      metrics: [
        { label: "Published Summaries", value: "-", detail: "Live sync pending", icon: BarChart3 },
        { label: "Active Events", value: "-", detail: "Live sync pending", icon: Activity },
        { label: "Open Registrations", value: "-", detail: "Live sync pending", icon: Calendar },
        { label: "Latest Collection", value: "-", detail: "Live sync pending", icon: ShieldCheck },
      ],
      latestSummary: null,
    };
  }
}

export default async function HomePage() {
  const { events, metrics, latestSummary } = await getLandingData();

  return (
    <PublicPageShell>
      <main className="flex flex-col min-h-screen">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden py-20 lg:py-32 section-shell">
          {/* Subtle background decoration */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
            <Badge variant="info" className="px-4 py-1.5 text-sm font-medium tracking-wide shadow-sm">
              MU CSE Society Official Platform
            </Badge>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground text-balance">
              Zero-Corruption <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
                Financial Transparency
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed">
              An enterprise-grade, audit-friendly system ensuring absolute integrity, 
              accountability, and clarity in all financial operations. Built for trust.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button asChild size="lg" className="w-full sm:w-auto text-base h-12 px-8 rounded-full shadow-lg hover:shadow-primary/25 transition-all">
                <Link href="/financial-summaries">
                  View Financial Reports
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-base h-12 px-8 rounded-full bg-background/50 backdrop-blur-sm">
                <Link href="/events">Explore Events</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* METRICS SECTION */}
        <section className="section-shell -mt-8 relative z-20 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.label} className="border-border/50 shadow-sm bg-panel/50 backdrop-blur-md hover:bg-panel transition-colors">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardDescription className="font-medium">{metric.label}</CardDescription>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{metric.value}</div>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                      {metric.detail}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* TRUST PILLARS */}
        <section className="section-shell py-16 lg:py-24 bg-muted/30 border-y border-border/50">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Built on Core Principles</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Our system enforces rigorous workflows to ensure every transaction is verified, justified, and publicly auditable.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner">
                <LockKeyhole className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">Secure Access Control</h3>
              <p className="text-muted-foreground leading-relaxed">
                Role-based boundaries ensure sensitive internal operations remain protected while exposing public-safe data.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">Verified Reconciliation</h3>
              <p className="text-muted-foreground leading-relaxed">
                Financial summaries are only published after multi-tier review and absolute settlement of all ledger entries.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner">
                <BarChart3 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">Public Auditability</h3>
              <p className="text-muted-foreground leading-relaxed">
                Students receive clear, high-level breakdowns of collected funds and expenditures without internal jargon.
              </p>
            </div>
          </div>
        </section>

        {/* LATEST SNAPSHOT & EVENTS */}
        <section className="section-shell py-16 lg:py-24">
          <div className="grid lg:grid-cols-[1fr_400px] gap-12">
            
            {/* LIVE EVENTS */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Public Events</h2>
                  <p className="mt-2 text-muted-foreground">Currently active and upcoming initiatives.</p>
                </div>
                <Button variant="ghost" asChild className="hidden sm:flex">
                  <Link href="/events">
                    View all <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              
              <div className="grid gap-4">
                {events.length > 0 ? (
                  events.slice(0, 3).map((event) => (
                    <Card key={event.id} className="group overflow-hidden border-border/60 hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center p-6 gap-6">
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge variant="outline" className="bg-background">
                                {event.status.replace(/_/g, " ")}
                              </Badge>
                              {event.registrationWindow.state === "OPEN" && (
                                <Badge variant="success" className="animate-pulse">
                                  Registration Open
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                              {event.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {event.description || "No description provided."}
                            </p>
                          </div>
                          <div className="shrink-0 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-border/50 sm:pl-6">
                            <Button asChild variant="secondary" className="w-full sm:w-auto">
                              <Link href={`/events/${event.slug}`}>
                                Details
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-dashed bg-muted/20">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-lg font-medium text-foreground">No active events</p>
                      <p className="text-sm text-muted-foreground">Check back later for upcoming public events.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <Button variant="ghost" asChild className="w-full sm:hidden">
                <Link href="/events">
                  View all events <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* LATEST FINANCIAL SNAPSHOT */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Latest Report</h2>
                <p className="mt-2 text-muted-foreground">Most recent published summary.</p>
              </div>

              {latestSummary ? (
                <Card className="relative overflow-hidden border-success/30 bg-success/5 shadow-lg">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ShieldCheck className="h-24 w-24" />
                  </div>
                  <CardHeader className="pb-4">
                    <Badge variant="success" className="w-fit mb-3">Officially Reconciled</Badge>
                    <CardTitle className="text-xl leading-snug">{latestSummary.event.title}</CardTitle>
                    <CardDescription className="text-success-foreground/70">
                      Verified public snapshot
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 relative z-10">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Total Collected</div>
                      <div className="text-2xl font-bold font-mono text-foreground">
                        {formatMoney(latestSummary.totals.collected)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Total Spent</div>
                      <div className="text-2xl font-bold font-mono text-foreground">
                        {formatMoney(latestSummary.totals.spent)}
                      </div>
                    </div>
                    <div className="pt-4 border-t border-success/20 space-y-1">
                      <div className="text-sm font-medium text-success-foreground">Closing Balance</div>
                      <div className="text-3xl font-black font-mono text-success">
                        {formatMoney(latestSummary.totals.closingBalance)}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 pb-6">
                    <Button asChild className="w-full bg-success hover:bg-success/90 text-success-foreground">
                      <Link href={`/financial-summaries/${latestSummary.id}`}>
                        View Full Breakdown
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card className="border-dashed bg-muted/20 h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                  <ShieldCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-foreground">No Published Reports</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Financial summaries will appear here once an event is fully reconciled and approved for public disclosure.
                  </p>
                </Card>
              )}
            </div>

          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}

