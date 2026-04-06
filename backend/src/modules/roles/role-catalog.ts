import { RoleCode } from "@prisma/client";

export const roleCatalog = [
  {
    code: RoleCode.SYSTEM_ADMIN,
    name: "System Administrator",
    description: "Maintains accounts, role structure, and protected system access.",
  },
  {
    code: RoleCode.FINANCIAL_CONTROLLER,
    name: "Financial Controller",
    description: "Handles finance-side verification, budget preparation, and reconciliation.",
  },
  {
    code: RoleCode.ORGANIZATIONAL_APPROVER,
    name: "Organizational Approver",
    description: "Approves or rejects sensitive finance requests with separation of duties.",
  },
  {
    code: RoleCode.EVENT_MANAGEMENT_USER,
    name: "Event Management User",
    description: "Submits event-side budget and expense requests.",
  },
  {
    code: RoleCode.GENERAL_STUDENT,
    name: "General Student",
    description: "Registers for events, submits payment proof, and files complaints.",
  },
  {
    code: RoleCode.COMPLAINT_REVIEW_AUTHORITY,
    name: "Complaint Review Authority",
    description: "Routes and reviews protected complaint records.",
  },
] as const;

