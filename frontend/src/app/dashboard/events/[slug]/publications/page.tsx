import { ListPagination } from "@/components/ui/list-pagination";
import { queryPage } from "@/lib/api/list";
import Link from "next/link";
import { ShieldAlert, Globe, CheckCircle2, AlertTriangle, ArrowRight, XCircle, Database, Lock, Eye } from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { getEventRolesForEvent, isSystemAdmin } from "@/lib/access";
import { listPublicFinancialSummaries } from "@/lib/api/public";
import {
  getReconciliationReport,
  listReconciliationReports,
} from "@/lib/api/internal";
import { apiFetchServer } from "@/lib/api/server";
import { buildRelativeHref } from "@/lib/detail-query";
import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getEventStatusTone,
  getPublicSummaryStateTone,
  getReconciliationStateTone,
} from "@/lib/format";
import type { ManagedEvent } from "@/types";
import {
  getHistoricalPublishedSnapshotCount,
  getLatestPublishedSummariesPerEvent,
} from "@/lib/public-summary";
import {
  PublishSummaryButton,
  UnpublishSummaryButton,
} from "@/components/internal/reconciliation-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

const publicationChecklist = [
  "Cryptographic reconciliation status must be FINALIZED.",
  "Underlying ledger data must be current (Not Stale).",
  "The event must be completed or closed before publication.",
  "Only approved summary figures are shared publicly.",
  "A published ledger snapshot forms an immutable historical record.",
] as const;

const publicIncluded = [
  "Aggregated collected, spent, and closing balance totals",
  "Summary-level categorical income and expenditure breakdown",
  "Publication timestamp bound to the finalized reconciliation ID",
] as const;

const publicExcluded = [
  "Raw payment proofs and uploaded documentary evidence",
  "Internal reviewer notes, approval histories, and complaint records",
  "Participant identities and private access logs",
] as const;

async function getEventBySlug(slug: string) {
  try {
    const response = await apiFetchServer<{ event: ManagedEvent }>(`/events/manage/${slug}`);
    return response.event;
  } catch {
    return null;
  }
}

export default async function EventDashboardPublicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sParams = await searchParams;
  const reportId = typeof sParams.reportId === "string" ? sParams.reportId : undefined;

  const [user, event] = await Promise.all([getCurrentUser(), getEventBySlug(slug)]);

  if (!user || !event) return null;

  const eventRoles = isSystemAdmin(user) ? ["SYSTEM_ADMIN" as const] : getEventRolesForEvent(user, event.id);
  const canSeePublications = isSystemAdmin(user) || eventRoles.includes("EVENT_ADMIN") || eventRoles.includes("FINANCIAL_CONTROLLER") || eventRoles.includes("ORGANIZATIONAL_APPROVER") || eventRoles.includes("EVENT_MANAGEMENT_USER");

  if (!canSeePublications) {
    return <StatePanel icon={ShieldAlert} tone="warning" title="Access restricted" description="Your event role does not include access to view publications." />;
  }

  const canPublish = eventRoles.includes("ORGANIZATIONAL_APPROVER");

  const [reports, allPublishedSummaries] = await Promise.all([
    listReconciliationReports({ page: queryPage(sParams.page), eventId: event.id, status: "FINALIZED" }),
    listPublicFinancialSummaries(),
  ]);
  const publishedSummaries = allPublishedSummaries.filter(s => s.event.id === event.id);
  const latestPublishedSummaries = getLatestPublishedSummariesPerEvent(publishedSummaries);
  const historicalPublishedSnapshotCount =
    getHistoricalPublishedSnapshotCount(publishedSummaries);
  const selectedReportId = reports.find((report) => report.id === reportId)?.id ?? reports[0]?.id;
  const selectedReport = selectedReportId ? await getReconciliationReport(selectedReportId) : null;
  const publishedForSelected = selectedReport
    ? publishedSummaries.find((summary) => summary.reconciliation.reportId === selectedReport.id) ??
      null
    : null;
  const latestPublishedForSelectedEvent = selectedReport
    ? latestPublishedSummaries.find((summary) => summary.event.id === selectedReport.event.id) ??
      null
    : null;
  const selectedReportHasHistoricalSnapshot =
    publishedForSelected !== null &&
    latestPublishedForSelectedEvent !== null &&
    publishedForSelected.id !== latestPublishedForSelectedEvent.id;
  const isPublishEligible =
    selectedReport &&
    selectedReport.status === "FINALIZED" &&
    !selectedReport.isStale &&
    (selectedReport.event.status === "COMPLETED" || selectedReport.event.status === "CLOSED");

  const basePath = `/dashboard/events/${slug}/publications`;

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* HERO SECTION */}
      <section className="workspace-intro">



        <div className="relative z-10 flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
          <div className="space-y-5 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="success" className="px-3 py-1 font-semibold border-success/30 bg-success/10 text-success">
                <Globe className="w-3 h-3 mr-1.5 inline-block" />
                Financial reporting
              </Badge>
              <Badge variant="info" className="px-3 py-1 font-semibold border-info/30 bg-info/10 text-info">
                Protected records
              </Badge>
              <Badge variant="neutral" className="px-3 py-1 font-semibold border-info/30 bg-info/10 text-info">
                {event.title}
              </Badge>
            </div>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground lg:text-4xl">
              Financial <span className="text-success">Publications</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed font-normal">
              Publish the approved financial summary for this event. Only a current, finalized reconciliation report is eligible; personal records and evidence remain private.
            </p>
          </div>

          <Link
            href={`/financial-summaries/${slug}`}
            className="flex items-center gap-3 rounded-2xl border border-success/15 bg-panel px-6 py-5 shadow-panel hover:bg-success/5 hover:border-success/30 transition-all group"
          >
            <div>
              <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">Public reporting</div>
              <div className="text-base font-semibold text-foreground group-hover:text-success transition-colors">Financial reports</div>
              <div className="text-xs text-muted-foreground font-normal mt-1">View the live transparent portal</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-success group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] items-start">

        {/* LEFT COLUMN: SELECTED REPORT SNAPSHOT */}
        <div className="space-y-8">
          <Card className="border-border/40 shadow-panel bg-panel relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
              <Database className="w-64 h-64" />
            </div>
            <CardHeader className="pb-4">
              <Badge variant="success" className="w-fit text-xs px-2 py-1 mb-2">Public summary preview</Badge>
              <CardTitle className="text-3xl tracking-tight mt-1">
                {selectedReport ? selectedReport.event.title : "No finalized report selected"}
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm font-normal mt-2 max-w-lg">
                {selectedReport
                  ? "Totals prepared for public reporting. Supporting documents and personal details stay private."
                  : "Generate and finalize a reconciliation report before publication capabilities are unlocked."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedReport ? (
                <div className="space-y-6">
                  {/* METRICS ROW */}
                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-xl border border-success/20 bg-success/5 px-5 py-4 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-success mb-2">Total Collected</div>
                      <div className="text-2xl font-semibold text-success tracking-tight">
                        {formatMoney(selectedReport.totalIncome)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-destructive mb-2">Total Spent</div>
                      <div className="text-2xl font-semibold text-destructive tracking-tight">
                        {formatMoney(selectedReport.totalExpense)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-primary/80 mb-2">Closing Balance</div>
                      <div className="text-2xl font-semibold text-primary tracking-tight">
                        {formatMoney(selectedReport.closingBalance)}
                      </div>
                    </div>
                  </div>

                  {/* POSTURE PANEL */}
                  <div className="rounded-xl border border-border/50 bg-panel p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <Badge variant={getReconciliationStateTone(selectedReport.status)} className="text-xs px-2 py-0.5 shadow-sm">
                        Recon {formatEnumLabel(selectedReport.status)}
                      </Badge>
                      <Badge variant={getEventStatusTone(selectedReport.event.status)} className="text-xs px-2 py-0.5 shadow-sm">
                        Event {formatEnumLabel(selectedReport.event.status)}
                      </Badge>
                      {publishedForSelected && (
                        <Badge variant={getPublicSummaryStateTone(publishedForSelected.status)} className="text-xs px-2 py-0.5 shadow-sm">
                          {formatEnumLabel(publishedForSelected.status)}
                        </Badge>
                      )}
                      {selectedReport.isStale && (
                        <Badge variant="danger" className="text-xs px-2 py-0.5 shadow-sm border-destructive/30 bg-destructive/10 text-destructive">
                          Data Stale
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-3 text-sm text-muted-foreground font-normal leading-relaxed border-t border-border/30 pt-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span>Finalized on <span className="font-mono text-foreground font-medium">{formatDateTime(selectedReport.finalizedAt)}</span></span>
                      </div>

                      {publishedForSelected ? (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-primary" />
                          <span>Broadcasted to public ledger at <span className="font-mono text-foreground font-medium">{formatDateTime(publishedForSelected.publishedAt)}</span></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-warning" />
                          <span className="italic">This report has not been published.</span>
                        </div>
                      )}

                      {selectedReport.isStale && (
                        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold mb-1">Integrity Alert</div>
                            <div className="text-xs">{selectedReport.staleReason ?? "Financial records changed after this report was generated. Create and finalize an updated report before publishing."}</div>
                          </div>
                        </div>
                      )}

                      {selectedReportHasHistoricalSnapshot && (
                        <div className="mt-4 rounded-xl border border-info/20 bg-info/10 px-4 py-3 text-info flex items-start gap-3">
                          <Eye className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold mb-1">Archival Version Present</div>
                            <div className="text-xs">An earlier publication remains in audit history. Public visitors see the latest published summary for this event.</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {publishedForSelected && (
                      <Link
                        href={`/financial-summaries/${selectedReport.event.slug}`}
                        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        Launch live public portal instance
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 flex justify-center">
                  <span className="text-muted-foreground font-normal text-sm italic">Select a finalized report to preview its public summary.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {canPublish && selectedReport && isPublishEligible && !publishedForSelected && (
            <PublishSummaryButton key={`publish-${selectedReport.id}`} reportId={selectedReport.id} />
          )}

          {canPublish && publishedForSelected && (
            <UnpublishSummaryButton
              key={`unpublish-${publishedForSelected.id}`}
              summaryId={publishedForSelected.id}
            />
          )}

          {/* ACTIVE QUEUE & LATEST PUBLICATIONS */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-border/40 shadow-panel bg-panel">
              <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="info" className="text-xs px-2 py-0.5 shadow-sm">Finalized Queue</Badge>
                </div>
                <CardTitle className="text-lg tracking-tight">Published summaries</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {reports.length === 0 ? (
                  <div className="p-6 text-center">
                    <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <div className="text-sm font-semibold text-foreground">Queue Empty</div>
                    <div className="text-xs text-muted-foreground mt-1">Reconciliation engine must seal a report first.</div>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {reports.map((report) => {
                      const isSelected = report.id === selectedReportId;
                      return (
                        <Link
                          key={report.id}
                          href={`${buildRelativeHref(basePath, sParams, { reportId: report.id })}#details-panel`}
                          className={`block p-4 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                          aria-current={isSelected ? "page" : undefined}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <div className={`font-bold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                              {report.event.title}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant={getEventStatusTone(report.event.status)} className="text-xs px-1.5 py-0">
                                {formatEnumLabel(report.event.status)}
                              </Badge>
                              {report.isStale && <Badge variant="danger" className="text-xs px-1.5 py-0">Stale</Badge>}
                            </div>
                          </div>
                          <div className={`text-xs font-mono ${isSelected ? "text-primary/80" : "text-muted-foreground"}`}>
                            {formatMoney(report.totalIncome)} In / {formatMoney(report.totalExpense)} Out
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {latestPublishedSummaries.length > 0 && (
              <Card className="border-border/40 shadow-panel bg-panel">
                <CardHeader className="border-b border-border/30 bg-success/5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="success" className="text-xs px-2 py-0.5 shadow-sm">Live Broadcasts</Badge>
                  </div>
                  <CardTitle className="text-lg tracking-tight">Public reports</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/30">
                    {latestPublishedSummaries.map((summary) => (
                      <Link
                        key={summary.id}
                        href={`/financial-summaries/${summary.event.slug}`}
                        className="block p-4 transition-colors hover:bg-success/5 group"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <div className="font-semibold text-sm text-foreground group-hover:text-success transition-colors">{summary.event.title}</div>
                          <Badge variant={getPublicSummaryStateTone(summary.status)} className="text-xs px-1.5 py-0 shadow-sm">
                            {formatEnumLabel(summary.status)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          Bal: {formatMoney(summary.totals.closingBalance)}
                        </div>
                      </Link>
                    ))}
                  </div>
                  {historicalPublishedSnapshotCount > 0 && (
                    <div className="p-4 bg-muted/20 text-xs text-muted-foreground italic text-center border-t border-border/30">
                      +{historicalPublishedSnapshotCount} earlier publication(s) retained in history.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: COMPLIANCE BOUNDARY */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-panel bg-panel">
            <CardHeader className="pb-4">
              <Badge variant="warning" className="w-fit text-xs px-2 py-0.5 mb-2 shadow-sm">Compliance Protocol</Badge>
              <CardTitle className="text-lg tracking-tight">Before you publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {publicationChecklist.map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border/50 bg-panel px-3 py-3 text-xs leading-5 text-muted-foreground">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-success/20 shadow-panel bg-panel relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
              <CheckCircle2 className="w-24 h-24" />
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg tracking-tight text-success flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Included in public reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {publicIncluded.map((item) => (
                <div key={item} className="rounded-lg border border-success/15 bg-success/5 px-3 py-3 text-xs leading-5 text-success font-medium">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-destructive/20 shadow-panel shadow-danger/5 bg-panel relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
              <XCircle className="w-24 h-24" />
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg tracking-tight text-destructive flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Kept private
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {publicExcluded.map((item) => (
                <div key={item} className="rounded-lg border border-destructive/15 bg-destructive/5 px-3 py-3 text-xs leading-5 text-destructive font-medium">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    <ListPagination pagination={reports.pagination} />
        </div>
  );
}
