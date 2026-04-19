export type AppRole =
  | "SYSTEM_ADMIN"
  | "FINANCIAL_CONTROLLER"
  | "ORGANIZATIONAL_APPROVER"
  | "EVENT_MANAGEMENT_USER"
  | "GENERAL_STUDENT"
  | "COMPLAINT_REVIEW_AUTHORITY";

export type AccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

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

export type BudgetState = "DRAFT" | "SUBMITTED" | "APPROVED" | "REVISED";

export type RequestState =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED";

export type ExpenseRecordState = "RECORDED" | "SETTLED" | "VOIDED";

export type IncomeSourceType = "SPONSOR" | "DONATION" | "UNIVERSITY_SUPPORT" | "MANUAL_OTHER";

export type IncomeState = "RECORDED" | "VERIFIED" | "REJECTED";

export type ApprovalEntityType = "BUDGET_REQUEST" | "EXPENSE_REQUEST";

export type ApprovalDecisionType = "APPROVED" | "REJECTED" | "RETURNED";

export type PublicSummaryStatus = "DRAFT" | "PUBLISHED";

export type PublicFinancialSummaryBreakdownLine = {
  key: string;
  label: string;
  segment: string;
  amount: string;
  recordCount: number;
};

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
  status: PublicSummaryStatus;
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
    incomeBreakdown: PublicFinancialSummaryBreakdownLine[];
    expenseBreakdown: PublicFinancialSummaryBreakdownLine[];
  } | null;
};

export type SupportingDocumentSummary = {
  id: string;
  category: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  viewPath: string;
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

export type ActorSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type EventSummary = {
  id: string;
  title: string;
  slug: string;
  status: EventStatus;
};

export type ManagedEvent = PublicEvent & {
  createdBy: ActorSummary | null;
};

export type PaymentVerificationQueueItem = {
  id: string;
  state: PaymentProofState;
  externalChannel: string;
  transactionReference: string | null;
  referenceText: string | null;
  amount: string | null;
  submittedAt: string;
  registration: {
    id: string;
    registrationCode: string;
    paymentState: RegistrationPaymentState;
    participantName: string;
    studentId: string;
    email: string;
    phone: string | null;
    participant: ActorSummary | null;
  };
  event: EventSummary;
  documents: SupportingDocumentSummary[];
  reviewedAt?: string | null;
  reviewerRemark?: string | null;
  reviewedBy?: ActorSummary | null;
};

export type IncomeRecord = {
  id: string;
  sourceType: IncomeSourceType;
  sourceLabel: string;
  amount: string;
  state: IncomeState;
  referenceText: string | null;
  collectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  event: EventSummary;
  recordedBy: ActorSummary | null;
  verifiedBy: ActorSummary | null;
  documents: SupportingDocumentSummary[];
};

export type BudgetItem = {
  id: string;
  category: string;
  label: string;
  amount: string;
  notes: string | null;
};

export type BudgetRecord = {
  id: string;
  version: number;
  title: string | null;
  state: BudgetState;
  totalAmount: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  event: EventSummary;
  createdBy: ActorSummary | null;
  items: BudgetItem[];
};

export type ApprovalDecisionRecord = {
  id: string;
  entityType: ApprovalEntityType;
  decision: ApprovalDecisionType;
  comment: string | null;
  createdAt: string;
  actor: ActorSummary;
};

export type BudgetRequestRecord = {
  id: string;
  amount: string;
  purpose: string;
  justification: string | null;
  state: RequestState;
  createdAt: string;
  updatedAt: string;
  event: EventSummary;
  requestedBy: ActorSummary | null;
  documents: SupportingDocumentSummary[];
  approvalDecisions: ApprovalDecisionRecord[];
};

export type ExpenseRecordSummary = {
  id: string;
  amount: string;
  category: string;
  state: ExpenseRecordState;
  paidAt: string | null;
  createdAt: string;
};

export type ExpenseRequestRecord = {
  id: string;
  amount: string;
  category: string;
  purpose: string;
  justification: string | null;
  state: RequestState;
  createdAt: string;
  updatedAt: string;
  event: EventSummary;
  requestedBy: ActorSummary | null;
  documents: SupportingDocumentSummary[];
  approvalDecisions: ApprovalDecisionRecord[];
  expenseRecords: ExpenseRecordSummary[];
};

export type ExpenseRecord = {
  id: string;
  amount: string;
  category: string;
  description: string;
  state: ExpenseRecordState;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  event: EventSummary;
  recordedBy: ActorSummary | null;
  expenseRequest: {
    id: string;
    amount: string;
    category: string;
    purpose: string;
    state: RequestState;
    requestedBy: ActorSummary | null;
  } | null;
  documents: SupportingDocumentSummary[];
};

export type ApprovalQueueItem = {
  entityType: ApprovalEntityType;
  entityId: string;
  state: RequestState;
  amount: string;
  createdAt: string;
  updatedAt: string;
  event: EventSummary;
  requestedBy: ActorSummary | null;
  documentCount: number;
  decisionCount: number;
  summary:
    | {
        purpose: string;
        justification: string | null;
      }
    | {
        category: string | null;
        purpose: string;
        justification: string | null;
      };
};

export type ComplaintQueueItem = {
  id: string;
  subject: string;
  state: ComplaintState;
  createdAt: string;
  updatedAt: string;
  event: EventSummary | null;
  submittedBy: ActorSummary | null;
  evidenceCount: number;
  lastRouting: ComplaintRoutingSummary | null;
  isEscalated: boolean;
};

export type ReconciliationBreakdown = {
  verifiedRegistrationIncome: string;
  manualIncome: string;
  settledExpense: string;
  verifiedPaymentProofCount: number;
  verifiedPaymentProofsMissingAmount: number;
  manualIncomeRecordCount: number;
  unverifiedManualIncomeRecordCount: number;
  settledExpenseRecordCount: number;
  pendingExpenseRecordCount: number;
  approvedExpenseRequestsWithoutSettledRecord: number;
};

export type ReconciliationBreakdownLine = PublicFinancialSummaryBreakdownLine;

export type ReconciliationSummarySnapshot = {
  id: string;
  status: PublicSummaryStatus;
  publishedAt: string | null;
};

export type ReconciliationReport = {
  id: string;
  status: ReconciliationState;
  totalIncome: string;
  totalExpense: string;
  closingBalance: string;
  isStale: boolean;
  staleReason: string | null;
  staledAt: string | null;
  warnings: string[];
  breakdown: ReconciliationBreakdown;
  incomeBreakdown?: ReconciliationBreakdownLine[];
  expenseBreakdown?: ReconciliationBreakdownLine[];
  createdAt: string;
  finalizedAt: string | null;
  event: EventSummary;
  generatedBy: ActorSummary | null;
  reviewedBy: ActorSummary | null;
  publicSummarySnapshots: ReconciliationSummarySnapshot[];
};

export type AuditLogRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  context: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  route: string | null;
  method: string | null;
  createdAt: string;
  actor: ActorSummary | null;
};
