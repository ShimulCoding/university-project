export type AppRole =
  | "SYSTEM_ADMIN"
  | "FINANCIAL_CONTROLLER"
  | "ORGANIZATIONAL_APPROVER"
  | "EVENT_MANAGEMENT_USER"
  | "GENERAL_STUDENT"
  | "COMPLAINT_REVIEW_AUTHORITY";

export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REGISTRATION_CLOSED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "ARCHIVED";

export type RegistrationWindowState = "UNAVAILABLE" | "UPCOMING" | "OPEN" | "CLOSED";

export type RegistrationPaymentState =
  | "PAYMENT_PENDING"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED";

export type PaymentProofState = "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";

export type ComplaintState =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ROUTED"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED";

export type ReconciliationState = "DRAFT" | "REVIEWED" | "FINALIZED";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  roles: AppRole[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicEvent = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: EventStatus;
  capacity: number | null;
  registeredCount: number;
  seatsRemaining: number | null;
  registrationWindow: {
    opensAt: string | null;
    closesAt: string | null;
    state: RegistrationWindowState;
  };
  schedule: {
    startsAt: string | null;
    endsAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type PublicFinancialSummary = {
  id: string;
  status: string;
  publishedAt: string | null;
  totals: {
    collected: string;
    spent: string;
    closingBalance: string;
  };
  event: {
    id: string;
    title: string;
    slug: string;
    status: EventStatus;
  };
  reconciliation: {
    reportId: string;
    status: ReconciliationState;
    finalizedAt: string | null;
  };
  payload: {
    basis: "FINALIZED_RECONCILIATION";
    summaryOnly: true;
    breakdown: {
      registrationIncome: string;
      manualIncome: string;
      settledExpense: string;
    };
  } | null;
};

export type SupportingDocumentSummary = {
  id: string;
  category: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type RegistrationEventSummary = {
  id: string;
  title: string;
  slug: string;
  status: EventStatus;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
};

export type RegistrationPaymentProof = {
  id: string;
  externalChannel: string;
  transactionReference: string | null;
  referenceText: string | null;
  amount: string | null;
  state: PaymentProofState;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerRemark: string | null;
  hasDocument?: boolean;
  documentCount?: number;
  documents?: SupportingDocumentSummary[];
};

export type RegistrationRecord = {
  id: string;
  registrationCode: string;
  paymentState: RegistrationPaymentState;
  participantName: string;
  studentId: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  event: RegistrationEventSummary;
  paymentProofs: RegistrationPaymentProof[];
};

export type ComplaintRoutingSummary = {
  id: string;
  state: ComplaintState;
  createdAt: string;
  note: string | null;
  fromRole: {
    id: string;
    code: AppRole;
    name: string;
  } | null;
  toRole: {
    id: string;
    code: AppRole;
    name: string;
  } | null;
  routedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export type ComplaintRecord = {
  id: string;
  subject: string;
  description: string;
  state: ComplaintState;
  createdAt: string;
  updatedAt: string;
  event: {
    id: string;
    title: string;
    slug: string;
    status: EventStatus;
  } | null;
  evidence: SupportingDocumentSummary[];
  submittedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  routingHistory: ComplaintRoutingSummary[];
};

export type ApiValidationIssues = {
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
};
