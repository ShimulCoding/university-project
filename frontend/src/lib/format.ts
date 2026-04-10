import type {
  BadgeTone,
  BudgetState,
  ComplaintState,
  EventStatus,
  ExpenseRecordState,
  IncomeState,
  PaymentProofState,
  PublicEvent,
  PublicSummaryStatus,
  ReconciliationState,
  RegistrationPaymentState,
  RegistrationWindowState,
  RequestState,
} from "@/types";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not specified";
  }

  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatMoney(value: string | number) {
  const amount = Number(value);

  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatFileSize(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getEventStatusTone(status: EventStatus): BadgeTone {
  switch (status) {
    case "PUBLISHED":
    case "IN_PROGRESS":
      return "info";
    case "COMPLETED":
    case "CLOSED":
      return "success";
    case "REGISTRATION_CLOSED":
      return "warning";
    default:
      return "neutral";
  }
}

export function getWindowStateTone(state: RegistrationWindowState): BadgeTone {
  switch (state) {
    case "OPEN":
      return "success";
    case "UPCOMING":
      return "info";
    case "CLOSED":
      return "warning";
    default:
      return "neutral";
  }
}

export function getPaymentStateTone(
  state: RegistrationPaymentState | PaymentProofState,
): BadgeTone {
  switch (state) {
    case "VERIFIED":
      return "success";
    case "PENDING_VERIFICATION":
      return "warning";
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}

export function getComplaintStateTone(state: ComplaintState): BadgeTone {
  switch (state) {
    case "RESOLVED":
    case "CLOSED":
      return "success";
    case "UNDER_REVIEW":
    case "ROUTED":
      return "info";
    case "ESCALATED":
      return "warning";
    default:
      return "neutral";
  }
}

export function getBudgetStateTone(state: BudgetState): BadgeTone {
  switch (state) {
    case "APPROVED":
      return "success";
    case "SUBMITTED":
      return "info";
    case "REVISED":
      return "warning";
    default:
      return "neutral";
  }
}

export function getRequestStateTone(state: RequestState): BadgeTone {
  switch (state) {
    case "APPROVED":
      return "success";
    case "SUBMITTED":
    case "PENDING_REVIEW":
      return "info";
    case "RETURNED":
      return "warning";
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}

export function getExpenseRecordStateTone(state: ExpenseRecordState): BadgeTone {
  switch (state) {
    case "SETTLED":
      return "success";
    case "VOIDED":
      return "danger";
    default:
      return "warning";
  }
}

export function getIncomeStateTone(state: IncomeState): BadgeTone {
  switch (state) {
    case "VERIFIED":
      return "success";
    case "REJECTED":
      return "danger";
    default:
      return "warning";
  }
}

export function getReconciliationStateTone(state: ReconciliationState): BadgeTone {
  switch (state) {
    case "FINALIZED":
      return "success";
    case "REVIEWED":
      return "info";
    default:
      return "warning";
  }
}

export function getPublicSummaryStateTone(state: PublicSummaryStatus): BadgeTone {
  return state === "PUBLISHED" ? "success" : "warning";
}

export function isRegistrationOpen(event: PublicEvent) {
  return event.status === "PUBLISHED" && event.registrationWindow.state === "OPEN";
}

export function sumMoney(values: Array<string | number | null | undefined>) {
  return values.reduce<number>((total, value) => total + Number(value ?? 0), 0);
}
