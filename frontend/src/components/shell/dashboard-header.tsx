"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserProfile } from "@/types";
import { dashboardNavigation, roleMeta } from "@/lib/navigation";
import { useRolePreview } from "@/components/providers/role-preview-provider";
import { InternalSessionCard } from "@/components/internal/internal-session-card";
import { RolePreviewSwitcher } from "@/components/shell/role-preview-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const dashboardTitles: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Internal command surface",
    description:
      "A role-aware foundation for verification, approvals, protected audit review, and publication-safe operations.",
  },
  "/dashboard/controls": {
    title: "Control patterns",
    description:
      "Reusable forms, tables, state panels, and filters for future business pages.",
  },
  "/dashboard/publications": {
    title: "Publication boundary",
    description:
      "A clear boundary between protected internal evidence and public-safe financial summaries.",
  },
  "/dashboard/payments": {
    title: "Payment verification queue",
    description:
      "Finance review stays evidence-aware, status-controlled, and clearly separated from the public surface.",
  },
  "/dashboard/income-records": {
    title: "Manual income records",
    description:
      "Track sponsor, donation, university support, and other event-linked income with protected evidence.",
  },
  "/dashboard/budgets": {
    title: "Budget management",
    description:
      "Preserve budget versions, item structure, and controlled activation without silent overwrite.",
  },
  "/dashboard/budget-requests": {
    title: "Budget requests",
    description:
      "Prepare and review funding requests with supporting documents and decision history.",
  },
  "/dashboard/expense-requests": {
    title: "Expense requests",
    description:
      "Keep requested spending separate from actual settled expense records.",
  },
  "/dashboard/expense-records": {
    title: "Expense records",
    description:
      "Capture actual paid or settled expenses with linkage back to approved request context.",
  },
  "/dashboard/approvals": {
    title: "Approval queue",
    description:
      "Operational approval stays explicit, auditable, and protected from self-approval.",
  },
  "/dashboard/complaints": {
    title: "Complaint review",
    description:
      "Protected complaint routing, escalation, and lifecycle handling remain internal-only.",
  },
  "/dashboard/reconciliation": {
    title: "Reconciliation workspace",
    description:
      "Compare event-linked income and expense, surface warnings clearly, and control closure.",
  },
  "/dashboard/audit": {
    title: "Protected audit views",
    description:
      "System administrators can inspect the trace history behind sensitive actions and access decisions.",
  },
};

export function DashboardHeader({ user }: { user: UserProfile }) {
  const pathname = usePathname();
  const { activeRole } = useRolePreview();
  const matchedNavigationItem = dashboardNavigation.find(
    (item) => item.href !== "/dashboard" && pathname.startsWith(item.href),
  );
  const current =
    dashboardTitles[pathname] ??
    (matchedNavigationItem ? dashboardTitles[matchedNavigationItem.href] : undefined) ??
    dashboardTitles["/dashboard"];

  return (
    <div className="surface-panel flex flex-col gap-6 p-5 md:flex-row md:items-start md:justify-between">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Internal workspace</Badge>
          <Badge variant="success">{roleMeta[activeRole].shortLabel}</Badge>
          <Badge variant="neutral">Foundation preview</Badge>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          {current?.title ?? "Internal command surface"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          {current?.description ??
            "A role-aware foundation for verification, approvals, protected audit review, and publication-safe operations."}
        </p>
        <div className="mt-5 rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
          <div className="data-kicker">Current role focus</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {roleMeta[activeRole].focus}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-3 md:min-w-[320px]">
        <RolePreviewSwitcher />
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/financial-summaries">View public side</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/">Landing page</Link>
          </Button>
        </div>
        <InternalSessionCard
          user={user}
          title="Live backend identity"
          description="Navigation and page actions are backed by this authenticated session, while the role preview narrows the internal UI focus."
        />
      </div>
    </div>
  );
}
