import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  SearchSlash,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
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
  getPublicSummaryStateTone,
  getReconciliationStateTone,
} from "@/lib/format";
import { hasAnyRole } from "@/lib/access";
import {
  PublishSummaryButton,
  ReconciliationActionPanel,
  ReconciliationGenerateForm,
} from "@/components/internal/reconciliation-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
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
    const user = await getCurrentUser();
    const canManage = hasAnyRole(user, ["SYSTEM_ADMIN", "FINANCIAL_CONTROLLER"]);
    const canFinalize = hasAnyRole(user, ["SYSTEM_ADMIN", "ORGANIZATIONAL_APPROVER"]);
    const canPublish = canFinalize;

    const [reports, events] = await Promise.all([
      listReconciliationReports({ eventId, status }),
      listInternalEventOptions(),
    ]);
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

    return (
      <>
        <PageHeader
          eyebrow="Reconciliation"
          title="Close the loop between verified income, settled expense, and public-safe publication"
          description="Reconciliation gathers event-linked financial records, surfaces warnings instead of hiding them, and keeps review, finalization, and publication as separate protected steps."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{reports.length} visible reports</Badge>
              <Badge variant="success">
                {reports.filter((report) => report.status === "FINALIZED").length} finalized
              </Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/reconciliation">
          <Field label="Event">
            <Select
              name="eventId"
              defaultValue={eventId ?? ""}
              options={[
                { value: "", label: "All events" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field label="Status">
            <Select
              name="status"
              defaultValue={status ?? ""}
              options={[
                { value: "", label: "All statuses" },
                { value: "DRAFT", label: "Draft" },
                { value: "REVIEWED", label: "Reviewed" },
                { value: "FINALIZED", label: "Finalized" },
              ]}
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_440px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Reconciliation reports</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {reports.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No reconciliation reports match this view"
                  description="Generate a report after verified income and settled expense data are ready for an event."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Income</TableHead>
                      <TableHead>Expense</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow
                        key={report.id}
                        data-state={report.id === selectedReportId ? "selected" : undefined}
                      >
                        <TableCell className="align-top">
                          <Link
                            href={buildRelativeHref("/dashboard/reconciliation", params, {
                              reportId: report.id,
                            })}
                            className={
                              report.id === selectedReportId
                                ? "focus-ring rounded-sm font-semibold text-primary"
                                : "focus-ring rounded-sm font-semibold text-foreground hover:text-primary hover:underline"
                            }
                            aria-current={report.id === selectedReportId ? "page" : undefined}
                          >
                            {report.event.title}
                          </Link>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant={getEventStatusTone(report.event.status)}>
                              {formatEnumLabel(report.event.status)}
                            </Badge>
                            {report.warnings.length > 0 ? (
                              <Badge variant="warning">{report.warnings.length} warning(s)</Badge>
                            ) : (
                              <Badge variant="success">No warnings</Badge>
                            )}
                            {report.isStale ? <Badge variant="danger">Stale</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>{formatMoney(report.totalIncome)}</TableCell>
                        <TableCell>{formatMoney(report.totalExpense)}</TableCell>
                        <TableCell>
                          <Badge variant={getReconciliationStateTone(report.status)}>
                            {formatEnumLabel(report.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedReport ? (
              <div key={selectedReport.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected report</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getReconciliationStateTone(selectedReport.status)}>
                        {formatEnumLabel(selectedReport.status)}
                      </Badge>
                      <Badge variant={getEventStatusTone(selectedReport.event.status)}>
                        {formatEnumLabel(selectedReport.event.status)}
                      </Badge>
                      {hasPublishedSnapshot ? (
                        <Badge variant="success">Public summary published</Badge>
                      ) : null}
                      {selectedReport.isStale ? (
                        <Badge variant="danger">Stale data</Badge>
                      ) : null}
                    </div>
                    {selectedReport.isStale ? (
                      <div className="rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-4 text-sm leading-6 text-destructive">
                        <div className="font-semibold">Financial records changed after this report was generated.</div>
                        <div className="mt-1">
                          {selectedReport.staleReason ??
                            "Generate a new reconciliation report before review, finalization, or publication."}
                        </div>
                        {selectedReport.staledAt ? (
                          <div className="mt-1 text-destructive/80">
                            Marked stale {formatDateTime(selectedReport.staledAt)}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                        <div className="data-kicker">Income</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">
                          {formatMoney(selectedReport.totalIncome)}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                        <div className="data-kicker">Expense</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">
                          {formatMoney(selectedReport.totalExpense)}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                        <div className="data-kicker">Closing balance</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">
                          {formatMoney(selectedReport.closingBalance)}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Generated by</div>
                        <div className="mt-2 text-foreground">
                          {selectedReport.generatedBy?.fullName ?? "Unknown"}
                        </div>
                        <div className="mt-1">{formatDateTime(selectedReport.createdAt)}</div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Reviewed / finalized</div>
                        <div className="mt-2 text-foreground">
                          {selectedReport.reviewedBy?.fullName ?? "No reviewer recorded"}
                        </div>
                        <div className="mt-1">{formatDateTime(selectedReport.finalizedAt)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Breakdown and integrity checks</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Verified registration income</div>
                      <div className="mt-2 text-foreground">
                        {formatMoney(selectedReport.breakdown.verifiedRegistrationIncome)}
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Manual income</div>
                      <div className="mt-2 text-foreground">
                        {formatMoney(selectedReport.breakdown.manualIncome)}
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Settled expense</div>
                      <div className="mt-2 text-foreground">
                        {formatMoney(selectedReport.breakdown.settledExpense)}
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Missing settled records</div>
                      <div className="mt-2 text-foreground">
                        {selectedReport.breakdown.approvedExpenseRequestsWithoutSettledRecord}
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Verified proofs missing amount</div>
                      <div className="mt-2 text-foreground">
                        {selectedReport.breakdown.verifiedPaymentProofsMissingAmount}
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Pending expense records</div>
                      <div className="mt-2 text-foreground">
                        {selectedReport.breakdown.pendingExpenseRecordCount}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {selectedReport.warnings.length > 0 ? (
                  <Card tone="muted">
                    <CardHeader>
                      <CardTitle className="text-xl">Warnings surfaced to reviewers</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {selectedReport.warnings.map((warning, index) => (
                        <div
                          key={`${warning}-${index}`}
                          className="rounded-[1rem] border border-warning/20 bg-warning-muted px-4 py-4 text-sm leading-6 text-warning"
                        >
                          {warning}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <StatePanel
                    icon={CheckCircle2}
                    title="No reconciliation warnings are currently raised"
                    description="The selected report did not surface missing links or integrity warnings in the current demo data."
                    tone="success"
                  />
                )}

                {selectedReport.publicSummarySnapshots.length > 0 ? (
                  <Card tone="success">
                    <CardHeader>
                      <CardTitle className="text-xl">Public summary snapshots</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {selectedReport.publicSummarySnapshots.map((snapshot) => (
                        <div
                          key={snapshot.id}
                          className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <Badge variant={getPublicSummaryStateTone(snapshot.status)}>
                              {formatEnumLabel(snapshot.status)}
                            </Badge>
                            <div className="text-sm text-muted-foreground">
                              {formatDateTime(snapshot.publishedAt)}
                            </div>
                          </div>
                          <Link
                            href={`/financial-summaries/${selectedReport.event.slug}`}
                            className="mt-3 inline-flex text-sm font-semibold text-primary hover:text-primary/80"
                          >
                            Open public summary
                          </Link>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                {(canManage || canFinalize) && !selectedReport.isStale ? (
                  <ReconciliationActionPanel
                    reportId={selectedReport.id}
                    canReview={canManage}
                    canFinalize={canFinalize}
                    status={selectedReport.status}
                  />
                ) : null}

                {canPublish && isPublishEligible && !hasPublishedSnapshot ? (
                  <PublishSummaryButton reportId={selectedReport.id} />
                ) : null}

                {!isPublishEligible && selectedReport.status === "FINALIZED" ? (
                  <StatePanel
                    icon={TriangleAlert}
                    title={
                      selectedReport.isStale
                        ? "This finalized report is stale"
                        : "This report is finalized but not yet publish-eligible"
                    }
                    description={
                      selectedReport.isStale
                        ? "A settled expense changed after generation. Generate, review, and finalize a fresh report before publishing."
                        : "Public summaries can only be published after the event is completed or closed."
                    }
                    tone="warning"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {canManage ? <ReconciliationGenerateForm events={events} /> : null}
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access reconciliation"
          description="The live backend keeps reconciliation inside finance, approver, and system-admin roles, with finalization and publication restricted further."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Reconciliation could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the reconciliation workspace."
        }
        tone="error"
      />
    );
  }
}
