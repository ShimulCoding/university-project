import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  BarChart3,
  LockKeyhole,
  Activity,
  Calendar,
  ChevronRight,
  Landmark,
  Scale
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
          detail: "Reconciled & published records.",
          icon: BarChart3,
        },
        {
          label: "Active Events",
          value: String(events.length),
          detail: "Live events currently managed.",
          icon: Activity,
        },
        {
          label: "Open Registrations",
          value: String(
            events.filter((event) => event.registrationWindow.state === "OPEN").length,
          ),
          detail: "Events accepting enrollments.",
          icon: Calendar,
        },
        {
          label: "Latest Collection",
          value: latestSummary ? formatMoney(latestSummary.totals.collected) : "N/A",
          detail: latestSummary
            ? `Verified collection total.`
            : "No verified collections yet.",
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
      <main className="flex flex-col min-h-screen bg-background selection:bg-primary/20">
        
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32 section-shell border-b border-border/10">
          {/* Subtle Dynamic Background Grid & Glows */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-50 blur-[100px]" />
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 max-w-5xl mx-auto text-center space-y-10">
            <Badge variant="neutral" className="px-5 py-2 text-xs md:text-sm font-semibold tracking-widest uppercase shadow-sm border-primary/20 bg-primary/5 text-primary backdrop-blur-md">
              Metropolitan University • CSE Society
            </Badge>
            
            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter text-foreground text-balance leading-none">
              Absolute <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/80 to-primary/40">
                Transparency.
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed font-light">
              The official financial ecosystem for the MU CSE Society. Every collected fund and authorized expense is meticulously tracked, reconciled, and publicly disclosed.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-6">
              <Button asChild size="lg" className="w-full sm:w-auto text-base h-14 px-10 rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
                <Link href="/financial-summaries">
                  View Public Ledger
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-base h-14 px-10 rounded-full bg-background/50 backdrop-blur-md border-border/50 hover:bg-muted/50 transition-all">
                <Link href="/events">Explore Initiatives</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* METRICS SECTION */}
        <section className="relative z-20 pb-20 px-4 md:px-8 max-w-7xl mx-auto -mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.label} className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardDescription className="font-medium text-muted-foreground">{metric.label}</CardDescription>
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-foreground tracking-tight">{metric.value}</div>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                      {metric.detail}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* TRUST PILLARS */}
        <section className="relative py-24 lg:py-32 bg-gradient-to-b from-background via-muted/30 to-background border-y border-border/10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="text-center max-w-3xl mx-auto mb-20 px-4">
            <Badge variant="neutral" className="mb-6 bg-background">Core Infrastructure</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight">Engineered for Trust</h2>
            <p className="mt-6 text-muted-foreground text-lg md:text-xl font-light leading-relaxed">
              Our system enforces rigorous cryptographic workflows to ensure every transaction is verified, justified, and publicly auditable.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 lg:px-8">
            <div className="group flex flex-col items-start p-8 rounded-3xl bg-background/40 border border-border/40 backdrop-blur-sm hover:bg-background transition-all hover:shadow-xl hover:shadow-primary/5">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-3">Role-Based Sovereignty</h3>
              <p className="text-muted-foreground leading-relaxed font-light">
                Strict RBAC boundaries ensure sensitive internal operations remain protected. Finance controllers and approvers act in isolation to prevent conflict of interest.
              </p>
            </div>
            
            <div className="group flex flex-col items-start p-8 rounded-3xl bg-background/40 border border-border/40 backdrop-blur-sm hover:bg-background transition-all hover:shadow-xl hover:shadow-primary/5">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-3">Immutable Ledger</h3>
              <p className="text-muted-foreground leading-relaxed font-light">
                Financial summaries are derived directly from settled payment endpoints. Reports are published only after multi-tier review and absolute settlement.
              </p>
            </div>
            
            <div className="group flex flex-col items-start p-8 rounded-3xl bg-background/40 border border-border/40 backdrop-blur-sm hover:bg-background transition-all hover:shadow-xl hover:shadow-primary/5">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
                <Landmark className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold tracking-tight mb-3">Public Auditability</h3>
              <p className="text-muted-foreground leading-relaxed font-light">
                Students receive uncompromised, high-fidelity breakdowns of collected funds and expenditures. No obfuscation, no internal jargon.
              </p>
            </div>
          </div>
        </section>

        {/* LATEST SNAPSHOT & EVENTS */}
        <section className="relative py-24 lg:py-32 section-shell">
          <div className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-16">
            
            {/* LIVE EVENTS */}
            <div className="space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Active Initiatives</h2>
                  <p className="mt-3 text-muted-foreground text-lg font-light">Currently active and upcoming events.</p>
                </div>
                <Button variant="ghost" asChild className="hidden sm:flex hover:bg-primary/5 hover:text-primary">
                  <Link href="/events">
                    View all events <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              
              <div className="grid gap-5">
                {events.length > 0 ? (
                  events.slice(0, 3).map((event) => (
                    <Card key={event.id} className="group overflow-hidden border-border/40 bg-background/50 backdrop-blur-sm hover:border-primary/40 transition-all shadow-sm hover:shadow-lg hover:shadow-primary/5 rounded-2xl">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center p-6 lg:p-8 gap-6">
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Badge variant="neutral" className="bg-muted/50 border-border/50 text-xs tracking-wider">
                                {event.status.replace(/_/g, " ")}
                              </Badge>
                              {event.registrationWindow.state === "OPEN" && (
                                <Badge variant="success" className="animate-pulse shadow-sm shadow-success/20 text-xs tracking-wider">
                                  Registration Open
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors tracking-tight">
                              {event.title}
                            </h3>
                            <p className="text-muted-foreground line-clamp-2 font-light leading-relaxed">
                              {event.description || "No description provided."}
                            </p>
                          </div>
                          <div className="shrink-0 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-border/40 sm:pl-8">
                            <Button asChild variant="outline" className="w-full sm:w-auto rounded-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                              <Link href={`/events/${event.slug}`}>
                                View Details
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-dashed border-border/50 bg-muted/10 rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-xl font-semibold text-foreground">No active events</p>
                      <p className="text-muted-foreground font-light mt-2">Check back later for upcoming public events.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <Button variant="ghost" asChild className="w-full sm:hidden rounded-full">
                <Link href="/events">
                  View all events <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* LATEST FINANCIAL SNAPSHOT */}
            <div className="space-y-10">
              <div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Latest Report</h2>
                <p className="mt-3 text-muted-foreground text-lg font-light">Most recent public disclosure.</p>
              </div>

              {latestSummary ? (
                <Card className="relative overflow-hidden border-success/20 bg-gradient-to-b from-success/10 to-success/5 shadow-2xl shadow-success/5 rounded-3xl">
                  <div className="absolute -top-12 -right-12 p-4 opacity-[0.03] rotate-12 pointer-events-none">
                    <ShieldCheck className="h-64 w-64" />
                  </div>
                  <CardHeader className="pb-6 pt-8 px-8">
                    <Badge variant="success" className="w-fit mb-4 text-xs tracking-wider shadow-sm shadow-success/20">Officially Reconciled</Badge>
                    <CardTitle className="text-2xl font-bold leading-tight tracking-tight">{latestSummary.event.title}</CardTitle>
                    <CardDescription className="text-success-foreground/70 font-medium mt-2">
                      Verified financial snapshot
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 relative z-10 px-8">
                    <div className="space-y-1.5">
                      <div className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Total Collected</div>
                      <div className="text-3xl font-black font-mono text-foreground tracking-tight">
                        {formatMoney(latestSummary.totals.collected)}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Total Spent</div>
                      <div className="text-3xl font-black font-mono text-foreground tracking-tight">
                        {formatMoney(latestSummary.totals.spent)}
                      </div>
                    </div>
                    <div className="pt-6 border-t border-success/20 space-y-2">
                      <div className="text-sm font-bold tracking-wide text-success-foreground uppercase">Closing Balance</div>
                      <div className="text-5xl font-black font-mono text-success tracking-tighter drop-shadow-sm">
                        {formatMoney(latestSummary.totals.closingBalance)}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 pb-8 px-8">
                    <Button asChild size="lg" className="w-full bg-success hover:bg-success/90 text-success-foreground rounded-full shadow-lg shadow-success/20 transition-all hover:-translate-y-0.5 h-14 text-base font-bold">
                      <Link href={`/financial-summaries/${latestSummary.id}`}>
                        View Full Ledger
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card className="border-dashed border-border/50 bg-muted/10 h-full min-h-[400px] flex flex-col items-center justify-center text-center p-10 rounded-3xl">
                  <ShieldCheck className="h-16 w-16 text-muted-foreground/30 mb-6" />
                  <p className="text-xl font-semibold text-foreground">No Published Reports</p>
                  <p className="text-muted-foreground font-light mt-3 leading-relaxed">
                    Financial summaries will appear here once an event is fully reconciled and cryptographically approved for public disclosure.
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
