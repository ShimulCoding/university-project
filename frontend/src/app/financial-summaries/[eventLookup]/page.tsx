import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, EyeOff } from "lucide-react";
import { notFound } from "next/navigation";

import {
  disclosureBoundary,
  publicationChecklist,
} from "@/features/foundation/data/demo-content";
import { getPublicFinancialSummary } from "@/lib/api/public";
import { ApiError } from "@/lib/api/shared";
import { formatDate, formatEnumLabel, formatMoney } from "@/lib/format";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function PublicFinancialSummaryDetailsPage({
  params,
}: {
  params: Promise<{ eventLookup: string }>;
}) {
  const { eventLookup } = await params;

  try {
    const summary = await getPublicFinancialSummary(eventLookup);

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Published summary details"
            title={summary.event.title}
            description="This view is generated from live published reconciliation output and exposes only the public-safe summary layer."
            action={
              <Badge variant="success">
                Published {formatDate(summary.publishedAt)}
              </Badge>
            }
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Summary snapshot</CardTitle>
                <CardDescription>
                  High-level totals and breakdowns that crossed the controlled public release boundary.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
                    <div className="data-kicker">Collected</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {formatMoney(summary.totals.collected)}
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
                    <div className="data-kicker">Spent</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {formatMoney(summary.totals.spent)}
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
                    <div className="data-kicker">Closing balance</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {formatMoney(summary.totals.closingBalance)}
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Summary line</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold text-foreground">
                        Verified registration income
                      </TableCell>
                      <TableCell>
                        {formatMoney(summary.payload?.breakdown.registrationIncome ?? "0")}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-foreground">
                        Manual income records
                      </TableCell>
                      <TableCell>
                        {formatMoney(summary.payload?.breakdown.manualIncome ?? "0")}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-foreground">
                        Settled expense records
                      </TableCell>
                      <TableCell>
                        {formatMoney(summary.payload?.breakdown.settledExpense ?? "0")}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card tone="success">
                <CardHeader>
                  <Badge variant="success">{formatEnumLabel(summary.reconciliation.status)}</Badge>
                  <CardTitle className="mt-3 text-xl">Reconciliation basis</CardTitle>
                  <CardDescription>
                    Finalized reconciliation report {summary.reconciliation.reportId} is the basis
                    for this public disclosure.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/events/${summary.event.slug}`}>
                      Open related event
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Release conditions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {publicationChecklist.map((item, index) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-[1.1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground"
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-panel text-xs font-semibold text-primary">
                        {index + 1}
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-10 grid gap-6 xl:grid-cols-2">
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
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Published summary details"
            title="This published summary is unavailable right now"
            description="The live backend could not return the requested summary."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Summary details could not be loaded"
              description={
                error instanceof Error
                  ? error.message
                  : "An unexpected error prevented the summary from loading."
              }
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
