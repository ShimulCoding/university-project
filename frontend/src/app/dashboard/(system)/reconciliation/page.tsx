import { ListPagination } from "@/components/ui/list-pagination";
import { queryPage } from "@/lib/api/list";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  SearchSlash,
  ShieldAlert,
  TriangleAlert,
  Scale,
  RefreshCcw,
  FileCheck,
  Globe,
  Database,
  ArrowRight,
} from "lucide-react";

import {
  getReconciliationReport,
  listInternalEventOptions,
  listReconciliationReports,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getEventStatusTone,
  getReconciliationStateTone,
} from "@/lib/format";
import {
  ReconciliationActionPanel,
  ReconciliationGenerateForm,
} from "@/components/internal/reconciliation-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { StatePanel } from "@/components/ui/state-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const reportId = typeof params.reportId === "string" ? params.reportId : undefined;

  try {
    const canManage = false;
    const canFinalize = false;

    const [reports, events] = await Promise.all([
      listReconciliationReports({ page: queryPage(params.page), eventId, status }),
      listInternalEventOptions(),
    ]);
    const reconcilableEvents = events.filter(
      (event) => event.status === "COMPLETED" || event.status === "CLOSED",
    );
    const selectedReportId = reports.find((report) => report.id === reportId)?.id ?? reports[0]?.id;
    const selectedReport = selectedReportId ? await getReconciliationReport(selectedReportId) : null;
    const hasPublishedSnapshot =
      selectedReport?.publicSummarySnapshots.some((snapshot) => snapshot.status === "PUBLISHED") ??
      false;
    const isPublishEligible =
      selectedReport &&
      selectedReport.status === "FINALIZED" &&
      !selectedReport.isStale &&
      (selectedReport.event.status === "COMPLETED" || selectedReport.event.status === "CLOSED");

    const finalizedCount = reports.filter((r) => r.status === "FINALIZED").length;

    return (
      <div className="flex flex-col gap-6 pb-8">
        {/* HERO SECTION */}
        <section className="workspace-intro">



          <div className="relative z-10 flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="info" className="px-3 py-1 font-semibold border-primary/30 bg-primary/10 text-primary">
                  <Scale className="w-3 h-3 mr-1.5 inline-block" />
                  Ledger Reconciliation
                </Badge>
              </div>

              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground lg:text-4xl">
                Financial <span className="text-success">Reconciliation</span>
              </h1>

              <p className="text-muted-foreground text-lg leading-relaxed font-normal">
                Compare verified income with settled expenses. Review warnings, finalize reports, and prepare approved public summaries.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Badge variant="neutral" className="bg-panel border-border/50 text-sm py-1.5">
                  <RefreshCcw className="w-4 h-4 mr-2 inline-block text-primary" />
                  {reports.length} Generated Report(s)
                </Badge>
                {finalizedCount > 0 && (
                  <Badge variant="success" className="text-sm py-1.5 border-success/30 bg-success/10">
                    <CheckCircle2 className="w-4 h-4 mr-2 inline-block" />
                    {finalizedCount} Finalized
                  </Badge>
                )}
              </div>
            </div>

            <Link
              href="/dashboard/publications"
              className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-panel px-6 py-5 shadow-panel hover:bg-primary/5 hover:border-primary/30 transition-all group"
            >
              <div>
                <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">Release Protocol</div>
                <div className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">Publication Engine</div>
                <div className="text-xs text-muted-foreground font-normal mt-1">View financial publications</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/reconciliation">
          <Field label="Event">
            <Select
              name="eventId"
              defaultValue={eventId ?? ""}
              options={[
                { value: "", label: "All Events" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field label="Reconciliation State">
            <Select
              name="status"
              defaultValue={status ?? ""}
              options={[
                { value: "", label: "All States" },
                { value: "DRAFT", label: "Draft Generation" },
                { value: "REVIEWED", label: "Controller Reviewed" },
                { value: "FINALIZED", label: " Finalized" },
              ]}
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] items-start">

          {/* REPORTS TABLE */}
          <Card className="border-border/40 shadow-panel bg-panel overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Reconciliation Ledger</CardTitle>
              <CardDescription>Select a report to review its totals, warnings and finalization status.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {reports.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No Reports Match Filters"
                    description="Reconciliation generation requires fully verified inflows and settled disbursements."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Event</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Total income</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Total expenses</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => {
                      const isSelected = report.id === selectedReportId;
                      return (
                        <TableRow
                          key={report.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/reconciliation", params, { reportId: report.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {report.event.title}
                            </Link>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant={getEventStatusTone(report.event.status)} className="text-xs px-1.5 py-0 shadow-sm">
                                {formatEnumLabel(report.event.status)}
                              </Badge>
                              {report.warnings.length > 0 ? (
                                <Badge variant="warning" className="text-xs px-1.5 py-0 shadow-sm">
                                  {report.warnings.length} Warning(s)
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-xs px-1.5 py-0 shadow-sm">
                                  Valid
                                </Badge>
                              )}
                              {report.isStale && <Badge variant="danger" className="text-xs px-1.5 py-0 shadow-sm">Stale</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-success">{formatMoney(report.totalIncome)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-destructive">{formatMoney(report.totalExpense)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getReconciliationStateTone(report.status)} className="text-xs px-2 py-0.5">
                              {formatEnumLabel(report.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* DETAIL PANEL */}
          <div id="details-panel" className="space-y-6">
            {selectedReport ? (
              <div key={selectedReport.id} className="space-y-6">

                {/* REPORT DETAIL CARD */}
                <Card className="border-primary/20 shadow-panel bg-panel relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <Database className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant={getReconciliationStateTone(selectedReport.status)} className="text-xs px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedReport.status)}
                      </Badge>
                      <Badge variant={getEventStatusTone(selectedReport.event.status)} className="text-xs px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedReport.event.status)}
                      </Badge>
                      {hasPublishedSnapshot && (
                        <Badge variant="info" className="text-xs px-2 py-1 shadow-sm bg-info/10 text-info border-info/30">
                          <Globe className="w-3 h-3 mr-1 inline-block" /> Live Broadcast Active
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Report details</CardTitle>
                    <CardDescription className="text-primary/80 font-medium">
                      {selectedReport.event.title}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {/* STALE ALERT */}
                    {selectedReport.isStale && (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-5 py-4 shadow-sm flex gap-4 items-start">
                        <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-destructive mb-1">State Mutation Detected</div>
                          <div className="text-xs text-destructive leading-relaxed font-normal">
                            {selectedReport.staleReason ?? "Underlying financial ledger has mutated since this report was sealed. A fresh reconciliation generation is required prior to further progression."}
                          </div>
                          {selectedReport.staledAt && (
                            <div className="text-xs uppercase tracking-widest text-destructive mt-2 font-mono">
                              Invalidated at {formatDateTime(selectedReport.staledAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* METRICS ROW */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 shadow-sm">
                        <div className="text-xs font-semibold tracking-widest uppercase text-success mb-2">Total income</div>
                        <div className="text-xl font-semibold text-success tracking-tight">
                          {formatMoney(selectedReport.totalIncome)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 shadow-sm">
                        <div className="text-xs font-semibold tracking-widest uppercase text-destructive mb-2">Total expenses</div>
                        <div className="text-xl font-semibold text-destructive tracking-tight">
                          {formatMoney(selectedReport.totalExpense)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
                        <div className="text-xs font-semibold tracking-widest uppercase text-primary/80 mb-2">Net Retained</div>
                        <div className="text-xl font-semibold text-primary tracking-tight">
                          {formatMoney(selectedReport.closingBalance)}
                        </div>
                      </div>
                    </div>

                    {/* AUDIT FOOTER */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                          <FileCheck className="h-3 w-3" /> Created by
                        </div>
                        <div className="font-semibold text-sm text-foreground">
                          {selectedReport.generatedBy?.fullName ?? "System"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          {formatDateTime(selectedReport.createdAt)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                          <CheckCircle2 className="h-3 w-3" /> Final review
                        </div>
                        <div className="font-semibold text-sm text-foreground">
                          {selectedReport.reviewedBy?.fullName ?? "Awaiting review"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          {selectedReport.finalizedAt ? formatDateTime(selectedReport.finalizedAt) : "N/A"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* BREAKDOWN & INTEGRITY */}
                <Card className="border-border/40 shadow-panel bg-panel">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg tracking-tight">Report checks</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
                    <div className="rounded-xl border border-border/50 bg-panel px-4 py-3 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Verified Registration</div>
                      <div className="text-sm font-mono font-semibold text-foreground">{formatMoney(selectedReport.breakdown.verifiedRegistrationIncome)}</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-panel px-4 py-3 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Manual Ledgers</div>
                      <div className="text-sm font-mono font-semibold text-foreground">{formatMoney(selectedReport.breakdown.manualIncome)}</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-panel px-4 py-3 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Settled Disbursements</div>
                      <div className="text-sm font-mono font-semibold text-foreground">{formatMoney(selectedReport.breakdown.settledExpense)}</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-panel px-4 py-3 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Dangling Requests</div>
                      <div className="text-sm font-mono font-semibold text-foreground">{selectedReport.breakdown.approvedExpenseRequestsWithoutSettledRecord}</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-panel px-4 py-3 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Incomplete Proofs</div>
                      <div className="text-sm font-mono font-semibold text-foreground">{selectedReport.breakdown.verifiedPaymentProofsMissingAmount}</div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-panel px-4 py-3 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">Pending Settlements</div>
                      <div className="text-sm font-mono font-semibold text-foreground">{selectedReport.breakdown.pendingExpenseRecordCount}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* WARNINGS */}
                {selectedReport.warnings.length > 0 ? (
                  <Card className="border-warning/20 shadow-panel shadow-warning/5 bg-panel relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                      <TriangleAlert className="w-24 h-24 text-warning" />
                    </div>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg tracking-tight text-warning flex items-center gap-2">
                        <TriangleAlert className="w-4 h-4" /> Items need attention
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {selectedReport.warnings.map((warning, index) => (
                        <div
                          key={`${warning.code}-${index}`}
                          className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant={warning.severity === "info" ? "info" : "warning"} className="text-xs px-2 py-0.5 shadow-sm">
                              {formatEnumLabel(warning.severity)}
                            </Badge>
                            <span className="text-xs font-semibold text-foreground">
                              {warning.message}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-warning">
                            CODE: {warning.code}
                            {typeof warning.count === "number" ? ` | FREQ: ${warning.count}` : ""}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <StatePanel
                    icon={CheckCircle2}
                    title="No warnings in this report"
                    description="No reconciliation warnings were found for this report."
                    tone="success"
                  />
                )}

                {/* ACTION PANEL */}
                {(canManage || canFinalize) && !selectedReport.isStale ? (
                  <ReconciliationActionPanel key={selectedReport.id}
                    reportId={selectedReport.id}
                    canReview={canManage}
                    canFinalize={canFinalize}
                    status={selectedReport.status}
                  />
                ) : null}

                {!isPublishEligible && selectedReport.status === "FINALIZED" ? (
                  <StatePanel
                    icon={TriangleAlert}
                    title={
                      selectedReport.isStale
                        ? "Report needs refreshing Active"
                        : "Publication Lock Active"
                    }
                    description={
                      selectedReport.isStale
                        ? "A settled expense changed after generation. Generate, review, and finalize a fresh report before publishing."
                        : "Complete or close the event before publishing its financial summary."
                    }
                    tone="warning"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {canManage ? <ReconciliationGenerateForm events={reconcilableEvents} /> : null}
      <ListPagination pagination={reports.pagination} />
        </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="pt-12">
          <StatePanel
            icon={ShieldAlert}
            title="Access restricted"
            description="Reconciliation generation and review routines are restricted to Finance Controllers. Finalization requires Organizational Approver credentials."
            tone="warning"
          />
        </div>
      );
    }

    return (
      <div className="pt-12">
        <StatePanel
          icon={AlertTriangle}
          title="Unable to load this page"
          description={
            error instanceof ApiError
              ? error.message
              : "An unexpected error disrupted the connection to the reconciliation engine."
          }
          tone="error"
        />
      </div>
    );
  }
}
