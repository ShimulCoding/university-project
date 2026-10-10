import Link from "next/link";
import {
  ShieldCheck,
  ChevronRight,
  Users,
  Activity,
  FileText,
  CheckSquare,
} from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { getEventRolesForEvent, isSystemAdmin } from "@/lib/access";
import { apiFetchServer } from "@/lib/api/server";
import {
  listPaymentVerificationQueue,
  listApprovalQueue,
  listBudgetRequests,
  listExpenseRequests,
  listReconciliationReports,
} from "@/lib/api/internal";
import { formatEnumLabel, getEventStatusTone } from "@/lib/format";
import { eventDashboardNavigation } from "@/lib/navigation";
import type { AppRole, ManagedEvent } from "@/types";
import type { PaginatedList } from "@/lib/api/list";
import { Badge } from "@/components/ui/badge";
import { EventStatusControl } from "@/components/internal/events-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function getEventBySlug(slug: string) {
  try {
    const response = await apiFetchServer<{ event: ManagedEvent }>(
      `/events/manage/${slug}`,
    );
    return response.event;
  } catch {
    return null;
  }
}

export default async function EventWorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, event] = await Promise.all([
    getCurrentUser(),
    getEventBySlug(slug),
  ]);

  if (!user || !event) {
    return null;
  }

  const eventRoles = isSystemAdmin(user)
    ? (["SYSTEM_ADMIN"] as AppRole[])
    : getEventRolesForEvent(user, event.id);

  const canSeeFinance =
    isSystemAdmin(user) || eventRoles.includes("FINANCIAL_CONTROLLER");
  const canSeeApprovals =
    isSystemAdmin(user) || eventRoles.includes("ORGANIZATIONAL_APPROVER");
  const canReadFinance = isSystemAdmin(user) || eventRoles.some((role) =>
    ["EVENT_ADMIN", "EVENT_MANAGEMENT_USER", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER"].includes(role),
  );
  const canManageLifecycle =
    event.status !== "DRAFT" &&
    (eventRoles.includes("EVENT_ADMIN") || eventRoles.includes("EVENT_MANAGEMENT_USER"));

  const count = async <T,>(request: Promise<PaginatedList<T>> | null): Promise<number | null> => {
    if (!request) return null;
    try { return (await request).pagination.totalItems; }
    catch { return null; }
  };

  const [verificationQueue, approvalQueue, budgetRequests, expenseRequests, reconciliationReports] =
    await Promise.all([
      count(
        canSeeFinance
          ? listPaymentVerificationQueue({ eventId: event.id })
          : null,
      ),
      count(
        canSeeApprovals
          ? listApprovalQueue({ eventId: event.id })
          : null,
      ),
      count(canReadFinance ? listBudgetRequests({ eventId: event.id }) : null),
      count(canReadFinance ? listExpenseRequests({ eventId: event.id }) : null),
      count(canReadFinance ? listReconciliationReports({ eventId: event.id }) : null),
    ]);

  const basePath = `/dashboard/events/${slug}`;

  const navigation = eventDashboardNavigation.filter(
    (item) =>
      item.href !== "" &&
      (isSystemAdmin(user) || eventRoles.some((role) => item.roles.includes(role))),
  );

  const metrics = [
    {
      label: "Pending Verification",
      value: verificationQueue ?? "Unavailable",
      detail: "Payment proofs awaiting review.",
      icon: FileText,
      visible: canSeeFinance,
    },
    {
      label: "Decision Queue",
      value: approvalQueue ?? "Unavailable",
      detail: "Workflows awaiting approval.",
      icon: CheckSquare,
      visible: canSeeApprovals,
    },
    {
      label: "Budget Requests",
      value: budgetRequests ?? "Unavailable",
      detail: "All funding proposals for this event.",
      icon: Activity,
      visible: canReadFinance,
    },
    {
      label: "Expense Requests",
      value: expenseRequests ?? "Unavailable",
      detail: "All spending requests for this event.",
      icon: Activity,
      visible: canReadFinance,
    },
  ].filter((m) => m.visible);

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="absolute top-0 right-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-primary/10 opacity-70 blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />

        <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:items-center justify-between">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge
                variant="success"
                className="px-3 py-1 font-semibold tracking-wider uppercase border-success/30 bg-success/10 text-success backdrop-blur-md"
              >
                <ShieldCheck className="w-3 h-3 mr-1.5 inline-block" />
                Event Team Active
              </Badge>
              <Badge
                variant={getEventStatusTone(event.status)}
                className="px-3 py-1 font-semibold tracking-wider uppercase backdrop-blur-md"
              >
                {formatEnumLabel(event.status)}
              </Badge>
            </div>
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              {event.title}
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              {event.description ||
                "Manage finances, verify submissions, and execute approvals within this event's scoped workspace."}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge
                variant="neutral"
                className="bg-background/50 backdrop-blur-sm border-border/50 text-xs"
              >
                {navigation.length} Modules Available
              </Badge>
              <Badge
                variant="neutral"
                className="bg-background/50 backdrop-blur-sm border-border/50 text-xs"
              >
                {event.registeredCount} Registrations
              </Badge>
              <Badge
                variant="neutral"
                className="bg-background/50 backdrop-blur-sm border-border/50 text-xs"
              >
                {canReadFinance ? `${reconciliationReports ?? "Unavailable"} Reports` : "Complaint review workspace"}
              </Badge>
            </div>
          </div>

          {/* Team members card */}
          {event.teamMembers.length > 0 && (
            <div className="lg:min-w-[320px] rounded-2xl border border-primary/15 bg-background/60 backdrop-blur-md p-6 shadow-xl shadow-primary/5 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-primary" />
                <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                  Event Team
                </div>
              </div>
              <div className="space-y-2">
                {event.teamMembers.slice(0, 5).map(
                  (member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="text-sm font-medium text-foreground">
                        {member.user.fullName}
                      </div>
                      <Badge
                        variant="info"
                        className="text-[9px] tracking-wider uppercase"
                      >
                        {formatEnumLabel(member.roleCode)}
                      </Badge>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* METRICS */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card
              key={metric.label}
              className="border-border/40 shadow-lg shadow-black/5 bg-background/40 backdrop-blur-xl hover:bg-background/60 transition-all duration-300 hover:-translate-y-1 group"
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardDescription className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">
                  {metric.label}
                </CardDescription>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-foreground tracking-tight">
                  {metric.value}
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed font-medium">
                  {metric.detail}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {canManageLifecycle ? <EventStatusControl key={event.id + event.status} event={event} /> : null}

      {/* QUICK ROUTES */}
      <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl">
        <CardHeader className="border-b border-border/30 bg-muted/10 py-4">
          <CardTitle className="text-lg tracking-tight">Event Modules</CardTitle>
          <CardDescription>
            Access event-specific modules for finance, approvals, and
            reconciliation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {navigation.map((item) => {
            const RouteIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={`${basePath}${item.href}`}
                className="group flex flex-col gap-1 rounded-xl border border-border/40 bg-background/50 p-4 transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-foreground group-hover:text-primary transition-colors tracking-tight">
                  <RouteIcon className="h-4 w-4" />
                  {item.label}
                  <ChevronRight className="h-3 w-3 ml-auto opacity-40" />
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
  );
}
