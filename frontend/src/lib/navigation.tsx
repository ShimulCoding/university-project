import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BadgeCheck,
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileBadge2,
  FileSearch,
  Files,
  Globe2,
  LayoutDashboard,
  Landmark,
  Megaphone,
  ReceiptText,
  ShieldCheck,
  ShieldEllipsis,
  WalletCards,
  Waypoints,
} from "lucide-react";

import type { AppRole } from "@/types";

export const publicNavigation = [
  { href: "/", label: "Overview" },
  { href: "/events", label: "Public events" },
  { href: "/financial-summaries", label: "Financial summaries" },
] as const;

export const roleMeta: Record<
  AppRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    focus: string;
  }
> = {
  SYSTEM_ADMIN: {
    label: "System Administrator",
    shortLabel: "Admin",
    description: "Monitors protected access, audit views, and cross-module integrity.",
    focus: "Role safety, protected views, and platform trust.",
  },
  EVENT_ADMIN: {
    label: "Event Administrator",
    shortLabel: "Event Admin",
    description:
      "Coordinates the assigned event-specific internal team, manages event configuration and oversight.",
    focus: "Event team coordination, lifecycle management, and cross-functional oversight.",
  },
  FINANCIAL_CONTROLLER: {
    label: "Financial Controller",
    shortLabel: "Finance",
    description:
      "Reviews payment proofs, records income, settles expenses, and generates reconciliation.",
    focus: "Verification quality, ledger integrity, and reconciliation readiness.",
  },
  ORGANIZATIONAL_APPROVER: {
    label: "Organizational Approver",
    shortLabel: "Approver",
    description:
      "Reviews high-trust requests and decides what becomes operational or publishable.",
    focus: "Decision clarity, separation of duties, and publish-safe oversight.",
  },
  EVENT_MANAGEMENT_USER: {
    label: "Event Management User",
    shortLabel: "Events",
    description:
      "Prepares event requests, monitors registrations, and tracks operational needs.",
    focus: "Request quality, event readiness, and student-facing execution.",
  },
  GENERAL_STUDENT: {
    label: "General Student",
    shortLabel: "Student",
    description:
      "Sees public-safe information, event listings, and personal participation status.",
    focus: "Clarity, confidence, and simple access to trustworthy records.",
  },
  COMPLAINT_REVIEW_AUTHORITY: {
    label: "Complaint Review Authority",
    shortLabel: "Complaints",
    description:
      "Routes sensitive complaints and protects evidence while preserving accountability.",
    focus: "Protected evidence, routing history, and procedural fairness.",
  },
};

export type DashboardNavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: AppRole[];
};

export const dashboardNavigation: DashboardNavigationItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    description: "Cross-role operating view",
    icon: LayoutDashboard,
    roles: [
      "SYSTEM_ADMIN",
      "EVENT_ADMIN",
      "FINANCIAL_CONTROLLER",
      "ORGANIZATIONAL_APPROVER",
      "EVENT_MANAGEMENT_USER",
      "COMPLAINT_REVIEW_AUTHORITY",
    ],
  },
  {
    href: "/dashboard/payments",
    label: "Verification",
    description: "Payment proof queue and review",
    icon: BadgeCheck,
    roles: ["SYSTEM_ADMIN", "FINANCIAL_CONTROLLER"],
  },
  {
    href: "/dashboard/events",
    label: "Events",
    description: "Create, launch, complete, and close events",
    icon: CalendarDays,
    roles: [
      "SYSTEM_ADMIN",
      "EVENT_ADMIN",
      "EVENT_MANAGEMENT_USER",
      "FINANCIAL_CONTROLLER",
      "ORGANIZATIONAL_APPROVER",
    ],
  },
  {
    href: "/dashboard/income-records",
    label: "Income records",
    description: "Manual income tracking and evidence",
    icon: Coins,
    roles: ["SYSTEM_ADMIN", "FINANCIAL_CONTROLLER"],
  },
  {
    href: "/dashboard/budgets",
    label: "Budgets",
    description: "Final approved event budgets",
    icon: WalletCards,
    roles: [
      "SYSTEM_ADMIN",
      "EVENT_ADMIN",
      "FINANCIAL_CONTROLLER",
      "ORGANIZATIONAL_APPROVER",
      "EVENT_MANAGEMENT_USER",
    ],
  },
  {
    href: "/dashboard/budget-requests",
    label: "Budget requests",
    description: "Budget versions, items, and review",
    icon: ClipboardList,
    roles: [
      "SYSTEM_ADMIN",
      "EVENT_ADMIN",
      "ORGANIZATIONAL_APPROVER",
      "EVENT_MANAGEMENT_USER",
    ],
  },
  {
    href: "/dashboard/expense-requests",
    label: "Expense requests",
    description: "Requested spending before settlement",
    icon: BriefcaseBusiness,
    roles: [
      "SYSTEM_ADMIN",
      "EVENT_ADMIN",
      "FINANCIAL_CONTROLLER",
      "ORGANIZATIONAL_APPROVER",
      "EVENT_MANAGEMENT_USER",
    ],
  },
  {
    href: "/dashboard/expense-records",
    label: "Expense records",
    description: "Recorded and settled spending",
    icon: ReceiptText,
    roles: [
      "SYSTEM_ADMIN",
      "EVENT_ADMIN",
      "FINANCIAL_CONTROLLER",
      "ORGANIZATIONAL_APPROVER",
      "EVENT_MANAGEMENT_USER",
    ],
  },
  {
    href: "/dashboard/approvals",
    label: "Approvals",
    description: "Decision queue and separation of duties",
    icon: ClipboardCheck,
    roles: ["SYSTEM_ADMIN", "ORGANIZATIONAL_APPROVER"],
  },
  {
    href: "/dashboard/complaints",
    label: "Complaints",
    description: "Protected review, routing, and escalation",
    icon: ShieldEllipsis,
    roles: ["SYSTEM_ADMIN", "EVENT_ADMIN", "ORGANIZATIONAL_APPROVER", "COMPLAINT_REVIEW_AUTHORITY"],
  },
  {
    href: "/dashboard/reconciliation",
    label: "Reconciliation",
    description: "Closure reports and warning checks",
    icon: Files,
    roles: ["SYSTEM_ADMIN", "EVENT_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER"],
  },
  {
    href: "/dashboard/publications",
    label: "Publications",
    description: "Public-safe release boundary",
    icon: Globe2,
    roles: ["SYSTEM_ADMIN", "EVENT_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER"],
  },
  {
    href: "/dashboard/audit",
    label: "Audit",
    description: "Protected logs and trace detail",
    icon: Archive,
    roles: ["SYSTEM_ADMIN"],
  },
  {
    href: "/dashboard/controls",
    label: "Controls",
    description: "Forms, filters, states, and queues",
    icon: ShieldCheck,
    roles: [
      "SYSTEM_ADMIN",
      "EVENT_ADMIN",
      "FINANCIAL_CONTROLLER",
      "ORGANIZATIONAL_APPROVER",
      "EVENT_MANAGEMENT_USER",
      "COMPLAINT_REVIEW_AUTHORITY",
    ],
  },
];

/**
 * Navigation items for the event-scoped workspace at /dashboard/events/[slug]/…
 * The `href` is relative to the event root — the shell prepends the event slug prefix.
 */
export const eventDashboardNavigation: DashboardNavigationItem[] = [
  {
    href: "",
    label: "Event Overview",
    description: "Event team dashboard and metrics",
    icon: LayoutDashboard,
    roles: ["EVENT_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER", "COMPLAINT_REVIEW_AUTHORITY"],
  },
  {
    href: "/payments",
    label: "Verification",
    description: "Payment proof queue for this event",
    icon: BadgeCheck,
    roles: ["EVENT_ADMIN", "FINANCIAL_CONTROLLER"],
  },
  {
    href: "/income-records",
    label: "Income records",
    description: "Event income tracking",
    icon: Coins,
    roles: ["EVENT_ADMIN", "FINANCIAL_CONTROLLER"],
  },
  {
    href: "/budgets",
    label: "Budgets",
    description: "Event budget versions",
    icon: WalletCards,
    roles: ["EVENT_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER"],
  },
  {
    href: "/budget-requests",
    label: "Budget requests",
    description: "Event funding proposals",
    icon: ClipboardList,
    roles: ["EVENT_ADMIN", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER"],
  },
  {
    href: "/expense-requests",
    label: "Expense requests",
    description: "Spending requests for this event",
    icon: BriefcaseBusiness,
    roles: ["EVENT_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER"],
  },
  {
    href: "/expense-records",
    label: "Expense records",
    description: "Settled spending for this event",
    icon: ReceiptText,
    roles: ["EVENT_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER"],
  },
  {
    href: "/approvals",
    label: "Approvals",
    description: "Event approval queue",
    icon: ClipboardCheck,
    roles: ["EVENT_ADMIN", "ORGANIZATIONAL_APPROVER"],
  },
  {
    href: "/complaints",
    label: "Complaints",
    description: "Event complaints review",
    icon: ShieldEllipsis,
    roles: ["EVENT_ADMIN", "ORGANIZATIONAL_APPROVER", "COMPLAINT_REVIEW_AUTHORITY"],
  },
  {
    href: "/reconciliation",
    label: "Reconciliation",
    description: "Event closure reports",
    icon: Files,
    roles: ["EVENT_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER"],
  },
  {
    href: "/publications",
    label: "Publications",
    description: "Public-safe release for this event",
    icon: Globe2,
    roles: ["EVENT_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER", "EVENT_MANAGEMENT_USER"],
  },
];

export const dashboardSupportLinks = [
  {
    title: "Disclosure standard",
    description:
      "Public pages expose summary-only outputs after finalized reconciliation.",
    icon: Landmark,
  },
  {
    title: "Audit posture",
    description:
      "Protected workflows preserve routing, reviewer identity, and decision history.",
    icon: FileSearch,
  },
  {
    title: "Working method",
    description:
      "Public-safe and internal views stay clearly separated in the interface.",
    icon: Waypoints,
  },
  {
    title: "Operational notes",
    description:
      "Queues, approvals, complaints, and publication steps are now tied to live backend routes.",
    icon: Megaphone,
  },
  {
    title: "Control language",
    description:
      "The internal shell uses one consistent review pattern: list, detail, action, and audit trail.",
    icon: BookOpenText,
  },
] as const;
