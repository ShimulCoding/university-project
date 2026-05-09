import Link from "next/link";
import {
  FileText,
  CheckSquare,
  ShieldAlert,
  Globe,
  Activity,
  User,
  ShieldCheck,
  ChevronRight,
  Database,
  LockKeyhole
} from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { hasAnyRole } from "@/lib/access";
import { listPublicFinancialSummaries } from "@/lib/api/public";
import {
  listApprovalQueue,
  listBudgetRequests,
  listComplaintReviewQueue,
  listExpenseRequests,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const user = await getCurrentUser();
  const roles = user?.roles ?? [];
  const canSeeFinance = hasAnyRole(user, ["SYSTEM_ADMIN", "FINANCIAL_CONTROLLER"]);
  const canSeeApprovals = hasAnyRole(user, ["SYSTEM_ADMIN", "ORGANIZATIONAL_APPROVER"]);
  const canSeeComplaints = hasAnyRole(user, [
    "SYSTEM_ADMIN",
    "ORGANIZATIONAL_APPROVER",
    "COMPLAINT_REVIEW_AUTHORITY",
  ]);
  const canSeeBudgetRequests = hasAnyRole(user, [
    "SYSTEM_ADMIN",
    "FINANCIAL_CONTROLLER",
    "ORGANIZATIONAL_APPROVER",
    "EVENT_MANAGEMENT_USER",
  ]);
  const canSeeReconciliation = hasAnyRole(user, [
    "SYSTEM_ADMIN",
    "FINANCIAL_CONTROLLER",
    "ORGANIZATIONAL_APPROVER",
  ]);
  const safeFetch = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
    promise.catch((error) => {
      console.error("Dashboard API fetch failed:", error);
      return fallback;
    });

  const [
    verificationQueue,
    approvalQueue,
    complaints,
    reconciliationReports,
    publicSummaries,
    budgetRequests,
    expenseRequests,
  ] = await Promise.all([
    safeFetch(canSeeFinance ? listPaymentVerificationQueue({}) : Promise.resolve([]), []),
    safeFetch(canSeeApprovals ? listApprovalQueue({}) : Promise.resolve([]), []),
    safeFetch(canSeeComplaints ? listComplaintReviewQueue({}) : Promise.resolve([]), []),
    safeFetch(canSeeReconciliation ? listReconciliationReports({}) : Promise.resolve([]), []),
    safeFetch(listPublicFinancialSummaries(), []),
    safeFetch(canSeeBudgetRequests ? listBudgetRequests({}) : Promise.resolve([]), []),
    safeFetch(canSeeBudgetRequests ? listExpenseRequests({}) : Promise.resolve([]), []),
  ]);
  
  const latestPublicSummaries = getLatestPublishedSummariesPerEvent(publicSummaries);
  const historicalPublishedSnapshotCount = getHistoricalPublishedSnapshotCount(publicSummaries);

  const quickLinks = dashboardNavigation
    .filter((item) => item.href !== "/dashboard" && item.href !== "/dashboard/controls")
    .filter((item) => item.roles.some((role) => roles.includes(role)));

  const metrics = [
    {
      label: "Pending Verification",
      value: verificationQueue.length,
      detail: "Payment proofs awaiting controller verification.",
      icon: FileText,
      visible: canSeeFinance,
    },
    {
      label: "Decision Queue",
      value: approvalQueue.length,
      detail: "Workflows awaiting authorized approval.",
      icon: CheckSquare,
      visible: canSeeApprovals,
    },
    {
      label: "Active Complaints",
      value: complaints.length,
      detail: "Protected grievance items under review.",
      icon: ShieldAlert,
      visible: canSeeComplaints,
    },
    {
      label: "Published Ledgers",
      value: latestPublicSummaries.length,
      detail: "Reconciled snapshots available publicly.",
      icon: Globe,
      visible: true,
    },
  ].filter((metric) => metric.visible);

  const budgetRequestQueueCount = budgetRequests.filter(
    (item) => item.state !== "APPROVED" && item.state !== "REJECTED",
  ).length;
  const expenseRequestQueueCount = expenseRequests.filter(
    (item) => item.state !== "APPROVED" && item.state !== "REJECTED",
  ).length;

  const queueRows = [
    {
      href: "/dashboard/payments",
      label: "Payment Verification",
      count: verificationQueue.length,
      detail: "External proof submissions queued for finance clearance.",
      visible: canSeeFinance,
    },
    {
      href: "/dashboard/budget-requests",
      label: "Budget Authorizations",
      count: budgetRequestQueueCount,
      detail: "Funding proposals waiting in the protected approval workflow.",
      visible: canSeeBudgetRequests,
    },
    {
      href: "/dashboard/expense-requests",
      label: "Expense Clearances",
      count: expenseRequestQueueCount,
      detail: "Expenditure requests waiting in the protected approval workflow.",
      visible: canSeeBudgetRequests,
    },
    {
      href: "/dashboard/approvals",
      label: "System Approvals",
      count: approvalQueue.length,
      detail: "Critical items requiring cross-tier authorization.",
      visible: canSeeApprovals,
    },
    {
      href: "/dashboard/complaints",
      label: "Dispute Resolutions",
      count: complaints.length,
      detail: "Encrypted complaints visible to escalation authorities.",
      visible: canSeeComplaints,
    },
  ].filter((item) => item.visible);

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* HERO / POSTURE SECTION */}
      <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="absolute top-0 right-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-primary/10 opacity-70 blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:items-center justify-between">
          <div className="space-y-4 max-w-2xl">
            <Badge variant="success" className="px-3 py-1 font-semibold tracking-wider uppercase border-success/30 bg-success/10 text-success backdrop-blur-md">
              <ShieldCheck className="w-3 h-3 mr-1.5 inline-block" />
              Secure Session Active
            </Badge>
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              Operations <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/80 to-primary/50">Command</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              Govern finances, verify submissions, and execute approvals within a zero-trust, completely auditable ecosystem. All actions are cryptographically bound to your identity.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="neutral" className="bg-background/50 backdrop-blur-sm border-border/50 text-xs">
                {quickLinks.length} Modules Authorized
              </Badge>
              <Badge variant="neutral" className="bg-background/50 backdrop-blur-sm border-border/50 text-xs">
                {latestPublicSummaries.length} Public Disclosures
              </Badge>
              {historicalPublishedSnapshotCount > 0 && (
                <Badge variant="neutral" className="bg-background/50 backdrop-blur-sm border-border/50 text-xs">
                  {historicalPublishedSnapshotCount} Archived Snapshots
                </Badge>
              )}
            </div>
          </div>

          <div className="lg:min-w-[320px] rounded-2xl border border-primary/15 bg-background/60 backdrop-blur-md p-6 shadow-xl shadow-primary/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-5 group-hover:scale-110 transition-all duration-500 pointer-events-none">
              <User className="w-24 h-24" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Authenticated Identity</div>
            </div>
            <div className="text-xl font-bold text-foreground tracking-tight">{user?.fullName}</div>
            <div className="text-sm text-muted-foreground font-mono mt-1">{user?.email}</div>
            <div className="mt-5 flex flex-wrap gap-2 relative z-10">
              {roles.map((role) => (
                <Badge key={role} variant="info" className="text-[10px] tracking-wider uppercase border-info/30 bg-info/10">
                  {formatEnumLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* METRICS ROW */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="border-border/40 shadow-lg shadow-black/5 bg-background/40 backdrop-blur-xl hover:bg-background/60 transition-all duration-300 hover:-translate-y-1 group">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardDescription className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">{metric.label}</CardDescription>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-foreground tracking-tight">{metric.value}</div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed font-medium">
                  {metric.detail}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* QUEUES & POSTURE */}
      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_0.8fr]">
        
        {/* ACTION QUEUES */}
        <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-border/30 bg-muted/10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning border border-warning/20">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-xl tracking-tight">Active Workflows</CardTitle>
                <CardDescription className="mt-1">Pending operations requiring immediate authorization or review.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Pipeline</TableHead>
                  <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Pending</TableHead>
                  <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Directive</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueRows.map((row) => (
                  <TableRow key={row.href} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-bold text-foreground px-6 py-4">
                      <Link href={row.href} className="flex items-center gap-2 hover:text-primary transition-colors">
                        {row.label}
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.count > 0 ? "warning" : "neutral"} className="font-mono px-2 py-0.5">
                        {row.count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-light">
                      {row.detail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-8 flex flex-col">
          
          {/* CLOSURE POSTURE */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl flex-1">
            <CardHeader className="border-b border-border/30 bg-muted/10">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center text-info border border-info/20">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-xl tracking-tight">System Settlement</CardTitle>
                  <CardDescription className="mt-1">Cryptographic reconciliation and reporting status.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/50 bg-background/50 p-5 hover:bg-muted/30 transition-colors">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Finalized Reports</div>
                  <div className="text-3xl font-black text-foreground">{reconciliationReports.filter((report) => report.status === "FINALIZED").length}</div>
                  <div className="mt-1 text-xs text-muted-foreground font-light">Out of {reconciliationReports.length} generated</div>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/50 p-5 hover:bg-muted/30 transition-colors">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Internal Reviews</div>
                  <div className="text-3xl font-black text-foreground">{reconciliationReports.filter((report) => report.status === "REVIEWED").length}</div>
                  <div className="mt-1 text-xs text-muted-foreground font-light">Awaiting closure</div>
                </div>
              </div>

              {reconciliationReports.slice(0, 2).map((report) => (
                <div key={report.id} className="rounded-2xl border border-border/50 bg-background/50 p-4 flex flex-col gap-1 hover:bg-muted/30 transition-colors">
                  <div className="font-bold text-foreground tracking-tight">{report.event.title}</div>
                  <div className="text-xs text-muted-foreground font-mono bg-muted/50 w-fit px-2 py-0.5 rounded">
                    IN: {formatMoney(report.totalIncome)} • OUT: {formatMoney(report.totalExpense)}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                    Updated {formatDateTime(report.finalizedAt ?? report.createdAt)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* QUICK ROUTES */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl">
            <CardHeader className="border-b border-border/30 bg-muted/10 py-4">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <LockKeyhole className="h-3 w-3" />
                </div>
                <CardTitle className="text-lg tracking-tight">Authorized Operations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
              {quickLinks.map((item) => {
                const RouteIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex flex-col gap-1 rounded-xl border border-border/40 bg-background/50 p-4 transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground group-hover:text-primary transition-colors tracking-tight">
                      {RouteIcon && <RouteIcon className="h-4 w-4" />}
                      {item.label}
                    </div>
                    <div className="text-xs leading-relaxed text-muted-foreground font-light">
                      {item.description}
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

        </div>
      </section>
    </div>
  );
}
