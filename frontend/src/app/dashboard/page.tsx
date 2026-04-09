import Link from "next/link";

import { getCurrentUser } from "@/lib/api/student";
import { hasAnyRole } from "@/lib/access";
import { listPublicFinancialSummaries } from "@/lib/api/public";
import {
  listApprovalQueue,
  listAuditLogs,
  listBudgetRequests,
  listComplaintReviewQueue,
  listExpenseRequests,
  listIncomeRecords,
  listPaymentVerificationQueue,
  listReconciliationReports,
} from "@/lib/api/internal";
import { formatDateTime, formatEnumLabel, formatMoney } from "@/lib/format";
import {
  getHistoricalPublishedSnapshotCount,
  getLatestPublishedSummariesPerEvent,
} from "@/lib/public-summary";
import { dashboardNavigation } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const user = await getCurrentUser();
  const roles = user?.roles ?? [];
  const canSeeFinance = hasAnyRole(user, ["SYSTEM_ADMIN", "FINANCIAL_CONTROLLER"]);
  const canSeeRequests = hasAnyRole(user, [
    "SYSTEM_ADMIN",
    "FINANCIAL_CONTROLLER",
    "ORGANIZATIONAL_APPROVER",
    "EVENT_MANAGEMENT_USER",
  ]);
  const canSeeApprovals = hasAnyRole(user, ["SYSTEM_ADMIN", "ORGANIZATIONAL_APPROVER"]);
  const canSeeComplaints = hasAnyRole(user, [
    "SYSTEM_ADMIN",
    "ORGANIZATIONAL_APPROVER",
    "COMPLAINT_REVIEW_AUTHORITY",
  ]);
  const canSeeReconciliation = hasAnyRole(user, [
    "SYSTEM_ADMIN",
    "FINANCIAL_CONTROLLER",
    "ORGANIZATIONAL_APPROVER",
  ]);
  const canSeeAudit = hasAnyRole(user, ["SYSTEM_ADMIN"]);

  const [
    verificationQueue,
    incomeRecords,
    budgetRequests,
    expenseRequests,
    approvalQueue,
    complaints,
    reconciliationReports,
    auditLogs,
    publicSummaries,
  ] = await Promise.all([
    canSeeFinance ? listPaymentVerificationQueue({}) : Promise.resolve([]),
    canSeeFinance ? listIncomeRecords({}) : Promise.resolve([]),
    canSeeRequests ? listBudgetRequests({}) : Promise.resolve([]),
    canSeeRequests ? listExpenseRequests({}) : Promise.resolve([]),
    canSeeApprovals ? listApprovalQueue({}) : Promise.resolve([]),
    canSeeComplaints ? listComplaintReviewQueue({}) : Promise.resolve([]),
    canSeeReconciliation ? listReconciliationReports({}) : Promise.resolve([]),
    canSeeAudit ? listAuditLogs({ limit: "5" }) : Promise.resolve([]),
    listPublicFinancialSummaries(),
  ]);
  const latestPublicSummaries = getLatestPublishedSummariesPerEvent(publicSummaries);
  const historicalPublishedSnapshotCount =
    getHistoricalPublishedSnapshotCount(publicSummaries);

  const quickLinks = dashboardNavigation
    .filter((item) => item.href !== "/dashboard" && item.href !== "/dashboard/controls")
    .filter((item) => item.roles.some((role) => roles.includes(role)));

  const metrics = [
    {
      label: "Payment proofs waiting",
      value: verificationQueue.length,
      detail: "Finance-only proof submissions still pending verification.",
      visible: canSeeFinance,
    },
    {
      label: "Decision queue",
      value: approvalQueue.length,
      detail: "Submitted requests waiting for approver action.",
      visible: canSeeApprovals,
    },
    {
      label: "Complaint review",
      value: complaints.length,
      detail: "Protected complaint items currently visible to internal reviewers.",
      visible: canSeeComplaints,
    },
    {
      label: "Public event pages",
      value: latestPublicSummaries.length,
      detail: "Latest public-safe summary currently visible per published event.",
      visible: true,
    },
  ].filter((metric) => metric.visible);

  const queueRows = [
    {
      href: "/dashboard/payments",
      label: "Payment verification",
      count: verificationQueue.length,
      detail: "External proof submissions waiting for finance review.",
      visible: canSeeFinance,
    },
    {
      href: "/dashboard/budget-requests",
      label: "Budget requests",
      count: budgetRequests.filter((request) => request.state !== "APPROVED").length,
      detail: "Funding requests still moving through the protected workflow.",
      visible: canSeeRequests,
    },
    {
      href: "/dashboard/expense-requests",
      label: "Expense requests",
      count: expenseRequests.filter((request) => request.state !== "APPROVED").length,
      detail: "Requested spending not yet fully closed.",
      visible: canSeeRequests,
    },
    {
      href: "/dashboard/approvals",
      label: "Approvals",
      count: approvalQueue.length,
      detail: "Items waiting for a decision that cannot be self-approved.",
      visible: canSeeApprovals,
    },
    {
      href: "/dashboard/complaints",
      label: "Complaints",
      count: complaints.length,
      detail: "Protected complaints visible to routing and escalation roles.",
      visible: canSeeComplaints,
    },
  ].filter((item) => item.visible);

  return (
    <>
      <PageHeader
        eyebrow="Internal overview"
        title="Operate finance, approvals, complaints, closure, and audit as one trust-first system"
        description="This landing view reflects the live backend session rather than foundation-only mock content. Public-safe publication stays separate from protected evidence, routing, decision, and audit layers."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Protected routes active</Badge>
            <Badge variant="warning">{quickLinks.length} internal views enabled</Badge>
            <Badge variant="info">{latestPublicSummaries.length} public page(s)</Badge>
            {historicalPublishedSnapshotCount > 0 ? (
              <Badge variant="neutral">
                {historicalPublishedSnapshotCount} historical snapshot(s)
              </Badge>
            ) : null}
          </div>
        }
      />

      <section className="surface-panel-muted grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div>
          <div className="data-kicker">Live backend posture</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Protected workflows stay operational, explicit, and audit-friendly.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            The internal shell now runs on the real verification, approval, complaints,
            reconciliation, publication, and audit modules. It is designed to read like a real
            operating surface, not a generic dashboard template.
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-primary/10 bg-panel px-5 py-5 shadow-sm">
          <div className="data-kicker">Current session</div>
          <div className="mt-3 text-lg font-semibold text-foreground">{user?.fullName}</div>
          <div className="mt-1 text-sm text-muted-foreground">{user?.email}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {roles.map((role) => (
              <Badge key={role} variant="info">
                {formatEnumLabel(role)}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <div className="data-kicker">{metric.label}</div>
            <div className="mt-4 text-3xl font-semibold text-primary">{metric.value}</div>
            <div className="mt-3 text-sm leading-6 text-muted-foreground">{metric.detail}</div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_0.92fr]">
        <Card>
          <CardHeader>
            <Badge variant="warning">Action queues</Badge>
            <CardTitle className="mt-3">Where protected work is still pending</CardTitle>
            <CardDescription>
              Each internal workflow keeps the same pattern: queue first, detail second, action
              third, and audit trail behind it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Open count</TableHead>
                  <TableHead>Current meaning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueRows.map((row) => (
                  <TableRow key={row.href}>
                    <TableCell className="font-semibold text-foreground">
                      <Link href={row.href} className="hover:text-primary">
                        {row.label}
                      </Link>
                    </TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Badge variant="info">Closure posture</Badge>
              <CardTitle className="mt-3">Reconciliation and publication boundary</CardTitle>
              <CardDescription>
                Closure becomes public only after reconciliation is finalized and an explicit
                summary-safe snapshot is published.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
              <div className="rounded-[1.1rem] border border-border/70 bg-panel-muted px-4 py-4">
                <div className="data-kicker">Reconciliation reports</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {reconciliationReports.length}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {reconciliationReports.filter((report) => report.status === "FINALIZED").length} finalized
                </div>
              </div>
              <div className="rounded-[1.1rem] border border-border/70 bg-panel-muted px-4 py-4">
                <div className="data-kicker">Manual income records</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {incomeRecords.length}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Event-linked records feeding closure and reporting
                </div>
              </div>
              <div className="md:col-span-2 rounded-[1.1rem] border border-border/70 bg-panel px-4 py-4">
                <div className="data-kicker">Public release posture</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">
                    {latestPublicSummaries.length} live public page(s)
                  </span>
                  {historicalPublishedSnapshotCount > 0 ? (
                    <Badge variant="neutral">
                      {historicalPublishedSnapshotCount} historical snapshot(s)
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  The public side resolves to the latest published release for each event,
                  while earlier published versions remain part of protected internal history.
                </div>
              </div>
              {reconciliationReports.slice(0, 2).map((report) => (
                <div
                  key={report.id}
                  className="md:col-span-2 rounded-[1.1rem] border border-border/70 bg-panel px-4 py-4"
                >
                  <div className="font-semibold text-foreground">{report.event.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {formatMoney(report.totalIncome)} income / {formatMoney(report.totalExpense)} expense / updated{" "}
                    {formatDateTime(report.finalizedAt ?? report.createdAt)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Badge variant="neutral">Quick routes</Badge>
              <CardTitle className="mt-3">Views available to this session</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[1.1rem] border border-border/70 bg-panel px-4 py-4 transition-colors hover:border-primary/20 hover:bg-panel-muted"
                >
                  <div className="text-sm font-semibold text-foreground">{item.label}</div>
                  <div className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {canSeeAudit && auditLogs.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-3">
          {auditLogs.map((log) => (
            <Card key={log.id} tone="muted">
              <CardHeader>
                <Badge variant="warning">{log.entityType}</Badge>
                <CardTitle className="mt-3 text-base">{log.action}</CardTitle>
                <CardDescription>{log.summary}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      ) : null}
    </>
  );
}
