import { AlertTriangle, CheckCircle2, Landmark, LineChart, Archive } from "lucide-react";

import { listPublicFinancialSummaries } from "@/lib/api/public";
import { ApiError } from "@/lib/api/shared";
import { formatMoney } from "@/lib/format";
import { PublicSummaryCard } from "@/components/public/public-summary-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import {
  getHistoricalPublishedSnapshotCount,
  getLatestPublishedSummariesPerEvent,
} from "@/lib/public-summary";

export const dynamic = "force-dynamic";

export default async function FinancialSummariesPage() {
  try {
    const summaries = await listPublicFinancialSummaries();
    const latestSummaries = getLatestPublishedSummariesPerEvent(summaries);
    const historicalSnapshotCount = getHistoricalPublishedSnapshotCount(summaries);
    const totalCollected = latestSummaries.reduce(
      (sum, summary) => sum + Number(summary.totals.collected),
      0,
    );

    return (
      <PublicPageShell>
        <main className="flex flex-col min-h-screen bg-background selection:bg-primary/20">
          
          {/* HERO HEADER */}
          <section className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-20 section-shell border-b border-border/10">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute top-0 left-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-success/10 opacity-60 blur-[120px] pointer-events-none -translate-x-1/3 -translate-y-1/3" />
            
            <div className="relative z-10 max-w-4xl space-y-6">
              <Badge variant="success" className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase shadow-sm border-success/20 bg-success/5 text-success backdrop-blur-md">
                Public Ledger
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground text-balance">
                Financial <span className="text-transparent bg-clip-text bg-gradient-to-br from-success via-success/80 to-success/50">Disclosures</span>
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed font-light">
                Explore fully verified and officially reconciled financial reports. Every disclosure published here has passed rigorous multi-tier review.
              </p>
            </div>
          </section>

          <section className="section-shell py-12 relative z-20">
            {/* METRICS */}
            <div className="grid gap-6 md:grid-cols-3 mb-16">
              <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Published Reports</CardDescription>
                  <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success border border-success/20">
                    <LineChart className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-foreground tracking-tight">{latestSummaries.length}</div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                    Verified event snapshots available publicly.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Total Disclosed Collection</CardDescription>
                  <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success border border-success/20">
                    <Landmark className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-success tracking-tight">{formatMoney(totalCollected)}</div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                    Aggregated funds across all published events.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardDescription className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Historical Snapshots</CardDescription>
                  <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success border border-success/20">
                    <Archive className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-foreground tracking-tight">{historicalSnapshotCount}</div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                    Legacy versions preserved for internal audit history.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* REPORT LISTING */}
            {latestSummaries.length === 0 ? (
              <Card className="border-dashed border-border/50 bg-muted/10 rounded-3xl">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <CheckCircle2 className="h-16 w-16 text-muted-foreground/30 mb-6" />
                  <p className="text-2xl font-bold text-foreground tracking-tight">No published disclosures</p>
                  <p className="text-muted-foreground font-light mt-3 max-w-md mx-auto">
                    When an initiative completes reconciliation and crosses the release boundary, its public-safe summary will be available here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-8 lg:grid-cols-2">
                {latestSummaries.map((summary) => (
                  <PublicSummaryCard key={summary.id} summary={summary} />
                ))}
              </div>
            )}
          </section>
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Unable to load public financial data right now.";

    return (
      <PublicPageShell>
        <main className="flex flex-col min-h-screen bg-background">
          <section className="relative overflow-hidden pt-24 pb-16 section-shell">
            <div className="relative z-10 max-w-4xl space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground text-balance">
                Financial Disclosures
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
