import Link from "next/link";
import { ShieldAlert, Globe, FileCheck, CheckCircle2, AlertTriangle, ArrowRight, XCircle, Database, Lock, Eye } from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { hasAnyRole } from "@/lib/access";
import { listPublicFinancialSummaries } from "@/lib/api/public";
import {
  getReconciliationReport,
  listReconciliationReports,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getEventStatusTone,
  getPublicSummaryStateTone,
  getReconciliationStateTone,
} from "@/lib/format";
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
  "Target initiative lifecycle must be COMPLETED or CLOSED.",
  "Strict isolation protocol: only summary payloads cross the boundary.",
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
  "Participant identity matrices and protected access logs",
] as const;

export default async function DashboardPublicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reportId = typeof params.reportId === "string" ? params.reportId : undefined;
  const user = await getCurrentUser();
  const canPublish = hasAnyRole(user, ["SYSTEM_ADMIN", "ORGANIZATIONAL_APPROVER"]);
  const [reports, publishedSummaries] = await Promise.all([
    listReconciliationReports({ status: "FINALIZED" }),
    listPublicFinancialSummaries(),
  ]);
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

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="absolute top-0 right-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-success/10 opacity-60 blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:items-center justify-between">
          <div className="space-y-5 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="success" className="px-3 py-1 font-semibold tracking-wider uppercase border-success/30 bg-success/10 text-success backdrop-blur-md">
                <Globe className="w-3 h-3 mr-1.5 inline-block" />
                Public Release Boundary
              </Badge>
              <Badge variant="info" className="px-3 py-1 font-semibold tracking-wider uppercase border-info/30 bg-info/10 text-info backdrop-blur-md">
                Zero-Trust Isolation
              </Badge>
            </div>
            
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              Financial <span className="text-transparent bg-clip-text bg-gradient-to-br from-success via-success/80 to-success/50">Publications</span>
            </h1>
            
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              Control the exact boundary between internal settlement ledgers and public disclosure. Only finalized, publish-safe reconciliation payloads may be broadcasted externally.
            </p>
          </div>

          <Link
            href="/financial-summaries"
            className="flex items-center gap-3 rounded-2xl border border-success/15 bg-background/60 backdrop-blur-md px-6 py-5 shadow-xl shadow-success/5 hover:bg-success/5 hover:border-success/30 transition-all group"
          >
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-1">External Portal</div>
              <div className="text-base font-bold text-foreground group-hover:text-success transition-colors">Public Ledgers</div>
              <div className="text-xs text-muted-foreground font-light mt-1">View the live transparent portal</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-success group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_0.9fr] items-start">
        
        {/* LEFT COLUMN: SELECTED REPORT SNAPSHOT */}
        <div className="space-y-8">
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
              <Database className="w-64 h-64" />
            </div>
            <CardHeader className="pb-4">
              <Badge variant="success" className="w-fit text-xs uppercase tracking-widest px-2 py-1 mb-2">Publish-Safe Snapshot Payload</Badge>
              <CardTitle className="text-3xl tracking-tight mt-1">
                {selectedReport ? selectedReport.event.title : "No finalized report selected"}
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm font-light mt-2 max-w-lg">
                {selectedReport
                  ? "Aggregated totals prepared for boundary extraction. Raw evidences remain strictly isolated."
                  : "Generate and finalize a reconciliation report before publication capabilities are unlocked."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedReport ? (
                <div className="space-y-6">
                  {/* METRICS ROW */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-success/20 bg-success/5 px-5 py-4 shadow-sm">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-success/80 mb-2">Total Collected</div>
                      <div className="text-2xl font-black text-success tracking-tight">
                        {formatMoney(selectedReport.totalIncome)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-danger/20 bg-danger/5 px-5 py-4 shadow-sm">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-danger/80 mb-2">Total Spent</div>
                      <div className="text-2xl font-black text-danger tracking-tight">
                        {formatMoney(selectedReport.totalExpense)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 shadow-sm">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-primary/80 mb-2">Closing Balance</div>
                      <div className="text-2xl font-black text-primary tracking-tight">
                        {formatMoney(selectedReport.closingBalance)}
                      </div>
                    </div>
                  </div>

                  {/* POSTURE PANEL */}
                  <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <Badge variant={getReconciliationStateTone(selectedReport.status)} className="text-[10px] uppercase tracking-widest px-2 py-0.5 shadow-sm">
                        Recon {formatEnumLabel(selectedReport.status)}
                      </Badge>
                      <Badge variant={getEventStatusTone(selectedReport.event.status)} className="text-[10px] uppercase tracking-widest px-2 py-0.5 shadow-sm">
                        Initiative {formatEnumLabel(selectedReport.event.status)}
                      </Badge>
                      {publishedForSelected && (
                        <Badge variant={getPublicSummaryStateTone(publishedForSelected.status)} className="text-[10px] uppercase tracking-widest px-2 py-0.5 shadow-sm">
                          {formatEnumLabel(publishedForSelected.status)}
                        </Badge>
                      )}
                      {selectedReport.isStale && (
                        <Badge variant="danger" className="text-[10px] uppercase tracking-widest px-2 py-0.5 shadow-sm border-danger/30 bg-danger/10 text-danger">
                          Data Stale
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-3 text-sm text-muted-foreground font-light leading-relaxed border-t border-border/30 pt-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span>Cryptographically Finalized at <span className="font-mono text-foreground font-medium">{formatDateTime(selectedReport.finalizedAt)}</span></span>
                      </div>
                      
                      {publishedForSelected ? (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-primary" />
                          <span>Broadcasted to public ledger at <span className="font-mono text-foreground font-medium">{formatDateTime(publishedForSelected.publishedAt)}</span></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-warning" />
                          <span className="italic">Payload securely contained. No public broadcast recorded.</span>
                        </div>
                      )}

                      {selectedReport.isStale && (
                        <div className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold mb-1">Integrity Alert</div>
                            <div className="text-xs opacity-90">{selectedReport.staleReason ?? "Underlying financial ledger has mutated since this report was sealed. A fresh reconciliation generation is required prior to public broadcast."}</div>
                          </div>
                        </div>
                      )}

                      {selectedReportHasHistoricalSnapshot && (
                        <div className="mt-4 rounded-xl border border-info/20 bg-info/10 px-4 py-3 text-info flex items-start gap-3">
                          <Eye className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold mb-1">Archival Version Present</div>
                            <div className="text-xs opacity-90">An older broadcast snapshot exists in the archival ledger. The public portal automatically resolves routing to the most recently published epoch.</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {publishedForSelected && (
                      <Link
                        href={`/financial-summaries/${selectedReport.event.slug}`}
                        className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        Launch live public portal instance
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 flex justify-center">
                  <span className="text-muted-foreground font-light text-sm italic">Select a finalized report from the queue to inspect its extraction payload.</span>
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
          <div className="grid gap-8 sm:grid-cols-2">
            <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl">
              <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="info" className="text-[10px] uppercase tracking-widest px-2 py-0.5 shadow-sm">Finalized Queue</Badge>
                </div>
                <CardTitle className="text-lg tracking-tight">Available Extractions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {reports.length === 0 ? (
                  <div className="p-6 text-center">
                    <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <div className="text-sm font-bold text-foreground">Queue Empty</div>
                    <div className="text-xs text-muted-foreground mt-1">Reconciliation engine must seal a report first.</div>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {reports.map((report) => {
                      const isSelected = report.id === selectedReportId;
                      return (
                        <Link
                          key={report.id}
                          href={`${buildRelativeHref("/dashboard/publications", params, { reportId: report.id })}#details-panel`}
                          className={`block p-4 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                          aria-current={isSelected ? "page" : undefined}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <div className={`font-bold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                              {report.event.title}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant={getEventStatusTone(report.event.status)} className="text-[9px] uppercase tracking-widest px-1.5 py-0">
                                {formatEnumLabel(report.event.status)}
                              </Badge>
                              {report.isStale && <Badge variant="danger" className="text-[9px] uppercase tracking-widest px-1.5 py-0">Stale</Badge>}
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
              <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl">
                <CardHeader className="border-b border-border/30 bg-success/5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="success" className="text-[10px] uppercase tracking-widest px-2 py-0.5 shadow-sm">Live Broadcasts</Badge>
                  </div>
                  <CardTitle className="text-lg tracking-tight">Public Portals</CardTitle>
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
                          <div className="font-bold text-sm text-foreground group-hover:text-success transition-colors">{summary.event.title}</div>
                          <Badge variant={getPublicSummaryStateTone(summary.status)} className="text-[9px] uppercase tracking-widest px-1.5 py-0 shadow-sm">
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
                      +{historicalPublishedSnapshotCount} archived epoch(s) secured in history.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: COMPLIANCE BOUNDARY */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl">
            <CardHeader className="pb-4">
              <Badge variant="warning" className="w-fit text-[10px] uppercase tracking-widest px-2 py-0.5 mb-2 shadow-sm">Compliance Protocol</Badge>
              <CardTitle className="text-lg tracking-tight">Pre-Release Validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {publicationChecklist.map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-3 text-xs leading-5 text-muted-foreground">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {index + 1}
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-success/20 shadow-xl shadow-success/5 bg-background/40 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
              <CheckCircle2 className="w-24 h-24" />
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg tracking-tight text-success flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Allowed Payload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {publicIncluded.map((item) => (
                <div key={item} className="rounded-lg border border-success/15 bg-success/5 px-3 py-3 text-xs leading-5 text-success/80 font-medium">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-danger/20 shadow-xl shadow-danger/5 bg-background/40 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
              <XCircle className="w-24 h-24" />
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg tracking-tight text-danger flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Blocked Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {publicExcluded.map((item) => (
                <div key={item} className="rounded-lg border border-danger/15 bg-danger/5 px-3 py-3 text-xs leading-5 text-danger/80 font-medium">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
