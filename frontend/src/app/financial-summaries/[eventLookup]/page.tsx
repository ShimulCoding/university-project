import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldCheck, CheckCircle2, TrendingUp, TrendingDown, Landmark } from "lucide-react";
import { notFound } from "next/navigation";

import { SummaryPdfDownloadButton } from "@/components/public/summary-pdf-download-button";
import { getPublicFinancialSummary } from "@/lib/api/public";
import { ApiError } from "@/lib/api/shared";
import { formatDate, formatEnumLabel, formatMoney } from "@/lib/format";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IncomePieChart } from "@/components/public/income-pie-chart";
import { ExpenseBudgetActualChart } from "@/components/public/expense-budget-actual-chart";
import { SummaryBreakdownChart } from "@/components/public/summary-breakdown-chart";
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
        <main className="flex flex-col min-h-screen bg-background selection:bg-primary/20">
          
          {/* HERO HEADER */}
          <section className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-20 section-shell border-b border-border/10">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute top-0 right-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-success/10 opacity-60 blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
            
            <div className="relative z-10 max-w-4xl space-y-6">
              <Badge variant="success" className="px-4 py-1.5 text-xs font-semibold tracking-widest uppercase shadow-sm border-success/20 bg-success/5 text-success backdrop-blur-md">
                Verified Disclosure
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground text-balance">
                {summary.event.title}
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed font-light">
                Official reconciled financial report. All figures are derived from settled transactions and have passed rigorous multi-tier review.
              </p>
              
              <div className="flex flex-wrap items-center gap-4 pt-6">
                <Badge variant="neutral" className="px-4 py-2 text-sm font-medium tracking-wide border-success/30 bg-background/50">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                  Published {formatDate(summary.publishedAt)}
                </Badge>
                <SummaryPdfDownloadButton summary={summary} />
              </div>
            </div>
          </section>

          <section className="section-shell py-12 relative z-20">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px] lg:items-start">
              
              {/* MAIN LEDGER AREA */}
              <div className="space-y-8">
                {/* METRICS */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Total Collected</CardDescription>
                        <TrendingUp className="h-4 w-4 text-primary opacity-70" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-black text-foreground tracking-tight">
                        {formatMoney(summary.totals.collected)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/60 backdrop-blur-2xl hover:bg-background/80 transition-all duration-300">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription className="font-medium text-muted-foreground uppercase tracking-wider text-xs">Total Spent</CardDescription>
                        <TrendingDown className="h-4 w-4 text-primary opacity-70" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-black text-foreground tracking-tight">
                        {formatMoney(summary.totals.spent)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-success/30 shadow-xl shadow-success/5 bg-success/5 backdrop-blur-2xl hover:bg-success/10 transition-all duration-300">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription className="font-medium text-success-foreground/80 uppercase tracking-wider text-xs">Closing Balance</CardDescription>
                        <Landmark className="h-4 w-4 text-success" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-black text-success tracking-tight">
                        {formatMoney(summary.totals.closingBalance)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/40 bg-background/50 backdrop-blur-xl shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold tracking-tight">Ledger Summary</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Consolidated overview of authorized revenue streams and expenditures.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="rounded-xl border border-border/50 overflow-hidden bg-background">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-10">Classification</TableHead>
                            <TableHead className="text-right font-semibold text-muted-foreground tracking-wider uppercase text-xs h-10">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="hover:bg-muted/10">
                            <TableCell className="font-semibold text-foreground py-4">
                              Verified registration income
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-foreground py-4">
                              {formatMoney(summary.payload?.breakdown.registrationIncome ?? "0")}
                            </TableCell>
                          </TableRow>
                          <TableRow className="hover:bg-muted/10">
                            <TableCell className="font-semibold text-foreground py-4">
                              Manual income records
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-foreground py-4">
                              {formatMoney(summary.payload?.breakdown.manualIncome ?? "0")}
                            </TableCell>
                          </TableRow>
                          <TableRow className="hover:bg-muted/10">
                            <TableCell className="font-semibold text-foreground py-4">
                              Settled expense records
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-foreground py-4">
                              {formatMoney(summary.payload?.breakdown.settledExpense ?? "0")}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div className="pt-6 border-t border-border/30">
                      <IncomePieChart
                        title="Revenue Distribution"
                        description="Visual distribution of verified registration and external income sources."
                        total={summary.totals.collected}
                        items={summary.payload?.incomeBreakdown ?? []}
                      />
                    </div>

                    <div className="pt-6 border-t border-border/30">
                      <ExpenseBudgetActualChart
                        title="Budget Utilization"
                        description="Comparative analysis of allocated budget vs actual settled expenditures across operational categories."
                        expenseItems={summary.payload?.expenseBreakdown ?? []}
                        budgetItems={summary.payload?.budgetBreakdown ?? []}
                      />
                    </div>

                    <div className="pt-6 border-t border-border/30 grid gap-8 lg:grid-cols-2">
                      <SummaryBreakdownChart
                        title="Revenue Sources"
                        description="Detailed itemization of incoming funds."
                        total={summary.totals.collected}
                        items={summary.payload?.incomeBreakdown ?? []}
                      />
                      <SummaryBreakdownChart
                        title="Expenditure Itemization"
                        description="Detailed categorization of all verified event expenses."
                        total={summary.totals.spent}
                        items={summary.payload?.expenseBreakdown ?? []}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SIDEBAR AREA */}
              <div className="space-y-6">
                <Card className="border-border/40 bg-background/50 backdrop-blur-xl shadow-lg overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                    <ShieldCheck className="w-32 h-32" />
                  </div>
                  <CardHeader>
                    <Badge variant="success" className="w-fit mb-3">{formatEnumLabel(summary.reconciliation.status)}</Badge>
                    <CardTitle className="text-xl font-bold tracking-tight">Reconciliation Context</CardTitle>
                    <CardDescription className="text-muted-foreground leading-relaxed mt-2">
                      This public disclosure is bound to the cryptographically finalized reconciliation report 
                      <span className="font-mono text-xs ml-1 bg-muted px-1 py-0.5 rounded text-foreground">{summary.reconciliation.reportId}</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Button asChild variant="outline" className="w-full rounded-full border-border/60 hover:bg-muted/50 transition-all font-medium">
                      <Link href={`/events/${summary.event.slug}`}>
                        View Event Page
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <PublicPageShell>
        <main className="flex flex-col min-h-screen bg-background">
          <section className="relative overflow-hidden pt-24 pb-16 section-shell border-b border-border/10">
            <div className="relative z-10 max-w-4xl space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground text-balance">
                Disclosure Unavailable
              </h1>
            </div>
          </section>
          
          <section className="section-shell py-12">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Summary Details Could Not Be Loaded"
              description={
                error instanceof Error
                  ? error.message
                  : "An unexpected error prevented the summary from loading."
              }
            />
          </section>
        </main>
      </PublicPageShell>
    );
  }
}
