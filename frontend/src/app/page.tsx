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
  Scale,
  GraduationCap,
  FileCheck
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
          label: "Published Reports",
          value: String(latestPublishedSummaries.length),
          detail: "Fully reconciled financial statements.",
          icon: FileCheck,
        },
        {
          label: "Active Initiatives",
          value: String(events.length),
          detail: "Currently managed university events.",
          icon: Activity,
        },
        {
          label: "Open Registrations",
          value: String(
            events.filter((event) => event.registrationWindow.state === "OPEN").length,
          ),
          detail: "Events currently accepting enrollments.",
          icon: Calendar,
        },
        {
          label: "Verified Collections",
          value: latestSummary ? formatMoney(latestSummary.totals.collected) : "N/A",
          detail: latestSummary
            ? `Total from latest authorized report.`
            : "Awaiting initial financial disclosure.",
          icon: ShieldCheck,
        },
      ],
      latestSummary,
    };
  } catch {
    return {
      events: [] as PublicEvent[],
      metrics: [
        { label: "Published Reports", value: "-", detail: "System synchronization in progress", icon: FileCheck },
        { label: "Active Initiatives", value: "-", detail: "System synchronization in progress", icon: Activity },
        { label: "Open Registrations", value: "-", detail: "System synchronization in progress", icon: Calendar },
        { label: "Verified Collections", value: "-", detail: "System synchronization in progress", icon: ShieldCheck },
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
        <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32 border-b border-border/40 bg-card/30">
          {/* Enhanced Premium Background Grid & Glows */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-primary/10 opacity-60 blur-[120px]" />
          <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[150px] pointer-events-none" />
          
          <div className="relative z-10 max-w-5xl mx-auto text-center space-y-10 px-4">
            <div className="flex justify-center items-center gap-3 flex-wrap">
              <Badge variant="neutral" className="px-5 py-2 text-sm font-semibold tracking-widest uppercase shadow-sm border-primary/20 bg-primary/5 text-primary backdrop-blur-md">
                <GraduationCap className="w-4 h-4 mr-2 inline-block" />
                University Administration
              </Badge>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight text-foreground text-balance leading-[1.1]">
              Institutional <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/90 to-primary/60">
                Financial Clarity.
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed font-medium">
              The centralized public portal for university initiatives. All financial operations, from event registrations to final expenditures, are rigorously audited and openly disclosed to ensure absolute accountability.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-6">
              <Button asChild size="lg" className="w-full sm:w-auto text-base h-14 px-10 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
                <Link href="/financial-summaries">
                  Access Public Ledger
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-base h-14 px-10 rounded-full bg-background/80 backdrop-blur-md border-border/60 hover:bg-muted/50 transition-all">
                <Link href="/events">Explore Programs</Link>
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
                <Card key={metric.label} className="border-border/50 shadow-lg shadow-black/5 bg-background/80 backdrop-blur-2xl hover:bg-background/90 transition-all duration-300 hover:-translate-y-1 rounded-3xl">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardDescription className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">{metric.label}</CardDescription>
                    <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-foreground tracking-tight">{metric.value}</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed font-medium">
                      {metric.detail}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* TRUST PILLARS */}
        <section className="relative py-24 lg:py-32 bg-gradient-to-b from-background via-muted/30 to-background border-y border-border/40 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="text-center max-w-3xl mx-auto mb-20 px-4">
            <Badge variant="neutral" className="mb-6 bg-background shadow-sm border-border/60 text-xs font-semibold tracking-widest uppercase">System Integrity</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight">Engineered for Trust</h2>
            <p className="mt-6 text-muted-foreground text-lg md:text-xl font-medium leading-relaxed">
              Our infrastructure enforces strict procedural compliance, ensuring that every institutional transaction is verified, authorized, and publicly auditable.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 lg:px-8">
            <div className="group flex flex-col items-start p-10 rounded-[2rem] bg-background/50 border border-border/50 backdrop-blur-xl hover:bg-background transition-all hover:shadow-2xl hover:shadow-primary/5">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
                <LockKeyhole className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-4">Role-Based Security</h3>
              <p className="text-muted-foreground leading-relaxed font-medium text-lg">
                Stringent access controls ensure sensitive operations are managed exclusively by authorized personnel, eliminating conflicts of interest.
              </p>
            </div>
            
            <div className="group flex flex-col items-start p-10 rounded-[2rem] bg-background/50 border border-border/50 backdrop-blur-xl hover:bg-background transition-all hover:shadow-2xl hover:shadow-primary/5">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
                <Scale className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-4">Immutable Ledger</h3>
              <p className="text-muted-foreground leading-relaxed font-medium text-lg">
                Financial records are derived directly from verified endpoints. Reports are finalized only after comprehensive administrative reconciliation.
              </p>
            </div>
            
            <div className="group flex flex-col items-start p-10 rounded-[2rem] bg-background/50 border border-border/50 backdrop-blur-xl hover:bg-background transition-all hover:shadow-2xl hover:shadow-primary/5">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
                <Landmark className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-4">Open Accountability</h3>
              <p className="text-muted-foreground leading-relaxed font-medium text-lg">
                Stakeholders receive transparent, high-fidelity insights into collected funds and organizational expenditures, ensuring absolute clarity.
              </p>
            </div>
          </div>
        </section>

        {/* LATEST SNAPSHOT & EVENTS */}
        <section className="relative py-24 lg:py-32 px-4 md:px-8 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_460px] gap-12 lg:gap-16">
            
            {/* LIVE EVENTS */}
            <div className="space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-6">
                <div>
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Active Programs</h2>
                  <p className="mt-3 text-muted-foreground text-lg font-medium">Currently managed university initiatives.</p>
                </div>
                <Button variant="ghost" asChild className="hidden sm:flex hover:bg-primary/5 hover:text-primary font-semibold">
                  <Link href="/events">
                    Browse Directory <ChevronRight className="ml-1 h-5 w-5" />
                  </Link>
                </Button>
              </div>
              
              <div className="grid gap-6">
                {events.length > 0 ? (
                  events.slice(0, 3).map((event) => (
                    <Card key={event.id} className="group overflow-hidden border-border/50 bg-background/60 backdrop-blur-md hover:border-primary/40 transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5 rounded-3xl">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center p-6 lg:p-8 gap-6">
                          <div className="flex-1 space-y-4">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Badge variant="neutral" className="bg-muted/50 border-border/60 text-xs tracking-widest font-semibold uppercase px-3 py-1">
                                {event.status.replace(/_/g, " ")}
                              </Badge>
                              {event.registrationWindow.state === "OPEN" && (
                                <Badge variant="neutral" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs tracking-widest font-semibold uppercase px-3 py-1">
                                  Enrollment Open
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-2xl font-extrabold text-foreground group-hover:text-primary transition-colors tracking-tight">
                              {event.title}
                            </h3>
                            <p className="text-muted-foreground line-clamp-2 font-medium leading-relaxed text-base">
                              {event.description || "Official university initiative. Click to view detailed information and registration status."}
                            </p>
                          </div>
                          <div className="shrink-0 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-border/40 sm:pl-8">
                            <Button asChild variant="secondary" className="w-full sm:w-auto rounded-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all font-semibold px-8 h-12">
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
                  <Card className="border-dashed border-border/60 bg-muted/20 rounded-3xl">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                      <Calendar className="h-14 w-14 text-muted-foreground/40 mb-5" />
                      <p className="text-2xl font-bold text-foreground tracking-tight">No Active Programs</p>
                      <p className="text-muted-foreground font-medium mt-3 text-lg">Check the directory later for upcoming university initiatives.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <Button variant="ghost" asChild className="w-full sm:hidden rounded-full h-14 font-semibold text-lg">
                <Link href="/events">
                  Browse Directory <ChevronRight className="ml-1 h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* LATEST FINANCIAL SNAPSHOT */}
            <div className="space-y-10">
              <div className="border-b border-border/40 pb-6">
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Latest Disclosure</h2>
                <p className="mt-3 text-muted-foreground text-lg font-medium">Most recent finalized financial report.</p>
              </div>

              {latestSummary ? (
                <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-b from-primary/10 to-background shadow-2xl shadow-primary/5 rounded-[2.5rem]">
                  <div className="absolute -top-12 -right-12 p-4 opacity-[0.04] rotate-12 pointer-events-none">
                    <BarChart3 className="h-64 w-64 text-primary" />
                  </div>
                  <CardHeader className="pb-6 pt-10 px-10">
                    <Badge variant="neutral" className="w-fit mb-5 text-xs tracking-widest font-semibold uppercase px-3 py-1 bg-background border-border/60 shadow-sm text-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline-block text-primary" />
                      Reconciled & Verified
                    </Badge>
                    <CardTitle className="text-3xl font-extrabold leading-tight tracking-tight text-balance">{latestSummary.event.title}</CardTitle>
                    <CardDescription className="text-muted-foreground font-medium mt-3 text-base">
                      Official administrative financial snapshot
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 relative z-10 px-10">
                    <div className="space-y-2 bg-background/50 p-5 rounded-2xl border border-border/40">
                      <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Total Collections
                      </div>
                      <div className="text-3xl font-black font-mono text-foreground tracking-tight">
                        {formatMoney(latestSummary.totals.collected)}
                      </div>
                    </div>
                    <div className="space-y-2 bg-background/50 p-5 rounded-2xl border border-border/40">
                      <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Total Expenditures
                      </div>
                      <div className="text-3xl font-black font-mono text-foreground tracking-tight">
                        {formatMoney(latestSummary.totals.spent)}
                      </div>
                    </div>
                    <div className="pt-8 border-t border-border/60 space-y-3">
                      <div className="text-sm font-bold tracking-widest text-primary uppercase">Final Net Balance</div>
                      <div className="text-5xl font-black font-mono text-foreground tracking-tighter drop-shadow-sm">
                        {formatMoney(latestSummary.totals.closingBalance)}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-6 pb-10 px-10">
                    <Button asChild size="lg" className="w-full rounded-full shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 h-16 text-lg font-bold">
                      <Link href={`/financial-summaries/${latestSummary.id}`}>
                        Review Complete Ledger
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card className="border-dashed border-border/60 bg-muted/20 h-full min-h-[450px] flex flex-col items-center justify-center text-center p-12 rounded-[2.5rem]">
                  <FileCheck className="h-16 w-16 text-muted-foreground/40 mb-6" />
                  <p className="text-2xl font-bold text-foreground tracking-tight">No Published Reports</p>
                  <p className="text-muted-foreground font-medium mt-4 leading-relaxed text-lg">
                    Financial disclosures will appear here once an initiative is fully reconciled and authorized for public viewing.
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