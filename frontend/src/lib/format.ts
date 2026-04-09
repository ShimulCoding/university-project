import type {
  BadgeTone,
  ComplaintState,
  EventStatus,
  PaymentProofState,
  PublicEvent,
  RegistrationPaymentState,
  RegistrationWindowState,
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

export function isRegistrationOpen(event: PublicEvent) {
  return event.status === "PUBLISHED" && event.registrationWindow.state === "OPEN";
}
