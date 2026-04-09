import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  FileSearch,
  Globe2,
  LayoutDashboard,
  Landmark,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

import type { AppRole } from "@/types";

export const publicNavigation = [
  { href: "/", label: "Overview" },
  { href: "/events", label: "Public events" },
  { href: "/financial-summaries", label: "Published summaries" },
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
      "FINANCIAL_CONTROLLER",
      "ORGANIZATIONAL_APPROVER",
      "EVENT_MANAGEMENT_USER",
      "GENERAL_STUDENT",
      "COMPLAINT_REVIEW_AUTHORITY",
    ],
  },
  {
    href: "/dashboard/controls",
    label: "Controls",
    description: "Forms, filters, states, and queues",
    icon: ShieldCheck,
    roles: [
      "SYSTEM_ADMIN",
      "FINANCIAL_CONTROLLER",
      "ORGANIZATIONAL_APPROVER",
      "EVENT_MANAGEMENT_USER",
      "COMPLAINT_REVIEW_AUTHORITY",
    ],
  },
  {
    href: "/dashboard/publications",
    label: "Publications",
    description: "Public-safe release boundary",
    icon: Globe2,
    roles: ["SYSTEM_ADMIN", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER"],
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
      "Foundation routes are placeholders for future business pages, not the final full app.",
    icon: BookOpenText,
  },
] as const;
