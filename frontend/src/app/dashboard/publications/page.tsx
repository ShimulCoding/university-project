import Link from "next/link";
import { ShieldAlert } from "lucide-react";

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
import { PublishSummaryButton } from "@/components/internal/reconciliation-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

const publicationChecklist = [
  "Reconciliation status must be Finalized.",
  "Event status must be Completed or Closed.",
  "Only public-safe summary data may cross the boundary.",
  "A published snapshot is immutable evidence of what was released.",
] as const;

const publicIncluded = [
  "Collected, spent, and closing balance totals",
  "Summary-only income and expense breakdown",
  "Publication timestamp and linked finalized reconciliation",
] as const;

const publicExcluded = [
  "Payment proofs and supporting evidence files",
  "Reviewer notes, approval remarks, and protected complaint detail",
  "Raw audit context or private participant information",
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
    (selectedReport.event.status === "COMPLETED" || selectedReport.event.status === "CLOSED");

  return (
    <>
      <PageHeader
        eyebrow="Publication boundary"
        title="Release public financial summaries only from finalized, publish-safe closure data"
        description="This surface makes the public boundary explicit: finalized reconciliation, completed or closed event status, and a summary-only payload that never leaks protected evidence."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
        <Card>
          <CardHeader>
            <Badge variant="success">Publish-safe snapshot</Badge>
            <CardTitle className="mt-3 text-2xl">
              {selectedReport ? selectedReport.event.title : "No finalized report selected"}
            </CardTitle>
            <CardDescription>
              {selectedReport
                ? "Only summary totals and the release basis move across the boundary."
                : "Generate and finalize a reconciliation report before publication becomes available."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
              <div className="data-kicker">Collected</div>
              <div className="amount-figure mt-2">
                {selectedReport ? formatMoney(selectedReport.totalIncome) : "Not ready"}
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
              <div className="data-kicker">Spent</div>
              <div className="amount-figure mt-2">
                {selectedReport ? formatMoney(selectedReport.totalExpense) : "Not ready"}
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
              <div className="data-kicker">Closing balance</div>
              <div className="amount-figure mt-2">
                {selectedReport ? formatMoney(selectedReport.closingBalance) : "Not ready"}
              </div>
            </div>
            {selectedReport ? (
              <div className="md:col-span-3 rounded-[1.2rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getReconciliationStateTone(selectedReport.status)}>
                    {formatEnumLabel(selectedReport.status)}
                  </Badge>
                  <Badge variant={getEventStatusTone(selectedReport.event.status)}>
                    {formatEnumLabel(selectedReport.event.status)}
                  </Badge>
                  {publishedForSelected ? (
                    <Badge variant={getPublicSummaryStateTone(publishedForSelected.status)}>
                      {formatEnumLabel(publishedForSelected.status)}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3">
                  Finalized {formatDateTime(selectedReport.finalizedAt)}.
                  {publishedForSelected
                    ? ` Published ${formatDateTime(publishedForSelected.publishedAt)}.`
                    : " No public snapshot has been published yet."}
                </div>
                {selectedReportHasHistoricalSnapshot ? (
                  <div className="mt-3 rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                    This report has an earlier published snapshot on record. The public page
                    resolves to the latest released version for this event.
                  </div>
                ) : null}
                {publishedForSelected ? (
                  <Link
                    href={`/financial-summaries/${selectedReport.event.slug}`}
                    className="mt-3 inline-flex font-semibold text-primary hover:text-primary/80"
                  >
                    Open the latest public summary page
                  </Link>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Badge variant="info">Live finalized reports</Badge>
              <CardTitle className="mt-3">Choose the report at the publication boundary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {reports.length === 0 ? (
                <StatePanel
                  icon={ShieldAlert}
                  title="No finalized reconciliation reports are ready"
                  description="Finance and approver roles must close the reconciliation step before publication is possible."
                  tone="empty"
                />
              ) : (
                reports.map((report) => (
                  <Link
                    key={report.id}
                    href={buildRelativeHref("/dashboard/publications", params, {
                      reportId: report.id,
                    })}
                    className={
                      report.id === selectedReportId
                        ? "focus-ring block rounded-[1.1rem] border border-primary/20 bg-panel-muted px-4 py-4 text-primary transition-colors"
                        : "focus-ring block rounded-[1.1rem] border border-border/70 bg-panel px-4 py-4 transition-colors hover:border-primary/20 hover:bg-panel-muted"
                    }
                    aria-current={report.id === selectedReportId ? "page" : undefined}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold text-foreground">{report.event.title}</div>
                      <Badge variant={getEventStatusTone(report.event.status)}>
                        {formatEnumLabel(report.event.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {formatMoney(report.totalIncome)} collected / {formatMoney(report.totalExpense)} spent
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {latestPublishedSummaries.length > 0 ? (
            <Card tone="success">
              <CardHeader>
                <CardTitle>Latest public-facing summaries</CardTitle>
                <CardDescription>
                  Internal history can contain multiple published snapshots for one event, but
                  the public side always resolves to the latest release.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {latestPublishedSummaries.map((summary) => (
                  <Link
                    key={summary.id}
                    href={`/financial-summaries/${summary.event.slug}`}
                    className="block rounded-[1.1rem] border border-border/70 bg-panel px-4 py-4 transition-colors hover:border-primary/20 hover:bg-panel-muted"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold text-foreground">{summary.event.title}</div>
                      <Badge variant={getPublicSummaryStateTone(summary.status)}>
                        {formatEnumLabel(summary.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Published {formatDateTime(summary.publishedAt)} / balance{" "}
                      {formatMoney(summary.totals.closingBalance)}
                    </div>
                  </Link>
                ))}
                {historicalPublishedSnapshotCount > 0 ? (
                  <div className="rounded-[1.1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                    {historicalPublishedSnapshotCount} earlier published snapshot(s) remain in
                    protected internal release history for audit and comparison purposes.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <Badge variant="info">Publish checklist</Badge>
              <CardTitle className="mt-3">The public release boundary stays explicit</CardTitle>
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
          <Card tone="success">
            <CardHeader>
              <CardTitle>Allowed into public pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {publicIncluded.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.1rem] border border-success/15 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card tone="muted">
            <CardHeader>
              <CardTitle>Blocked from public pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {publicExcluded.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          {canPublish && selectedReport && isPublishEligible && !publishedForSelected ? (
            <PublishSummaryButton reportId={selectedReport.id} />
          ) : null}
        </div>
      </div>
    </>
  );
}
