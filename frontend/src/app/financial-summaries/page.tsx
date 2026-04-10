import { AlertTriangle, CheckCircle2, EyeOff, ShieldCheck } from "lucide-react";

import { disclosureBoundary, publicationChecklist } from "@/features/foundation/data/demo-content";
import { listPublicFinancialSummaries } from "@/lib/api/public";
import { ApiError } from "@/lib/api/shared";
import { formatMoney } from "@/lib/format";
import { PublicSummaryCard } from "@/components/public/public-summary-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Published summaries"
            title="Public-safe financial outcomes, not raw internal operations"
            description="Published summaries come from the live backend and only expose totals and high-level breakdowns that have crossed the finalized publication boundary."
          />

          <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4 md:grid-cols-3">
              <Card tone="muted" className="flex h-full flex-col justify-between">
                <div className="data-kicker">Published events</div>
                <div className="mt-4 text-3xl font-semibold text-primary">
                  {latestSummaries.length}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Latest public-safe snapshot currently visible for each published event.
                </p>
              </Card>
              <Card tone="muted" className="flex h-full flex-col justify-between">
                <div className="data-kicker">Total disclosed collection</div>
                <div className="metric-figure mt-4">
                  {formatMoney(totalCollected)}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Aggregated across the latest published snapshot for each event.
                </p>
              </Card>
              <Card tone="muted" className="flex h-full flex-col justify-between">
                <div className="data-kicker">Historical snapshots</div>
                <div className="mt-4 text-3xl font-semibold text-primary">
                  {historicalSnapshotCount}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Earlier published versions stay part of protected internal release history.
                </p>
              </Card>
            </div>
            <Card className="h-full">
              <CardHeader>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="mt-4 text-xl">Publication is a governed release, not a data dump</CardTitle>
                <CardDescription>
                  The public side shows only the latest published snapshot per event:
                  understandable totals, traceable timing, and confidence that unreconciled
                  data has not leaked.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {latestSummaries.length === 0 ? (
            <div className="mt-10">
              <StatePanel
                icon={CheckCircle2}
                tone="empty"
                title="No published financial summaries are available yet"
                description="When an event completes reconciliation and crosses the release boundary, its public-safe summary will appear here."
              />
            </div>
          ) : (
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {latestSummaries.map((summary) => (
                <PublicSummaryCard key={summary.id} summary={summary} />
              ))}
            </div>
          )}

          <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <CardHeader>
                <Badge variant="info">Release conditions</Badge>
                <CardTitle className="mt-3 text-xl">
                  A summary becomes public only after closure logic passes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {publicationChecklist.map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-panel text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card tone="success">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <CardTitle className="text-xl">Included publicly</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {disclosureBoundary.publicIncluded.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.15rem] border border-success/15 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card tone="muted">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <EyeOff className="h-5 w-5 text-warning-foreground" />
                    <CardTitle className="text-xl">Kept protected</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {disclosureBoundary.publicExcluded.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.15rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Published summaries"
            title="Public summaries are temporarily unavailable"
            description="This page depends on live publish-safe backend data. If that data cannot be reached, the failure is shown explicitly."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Published summaries could not be loaded"
              description={
                error instanceof ApiError
                  ? error.message
                  : "An unexpected error prevented the summaries from loading."
              }
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
