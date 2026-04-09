export const landingMetrics = [
  {
    value: "6",
    label: "role-specific control layers",
    detail:
      "Each internal workflow is scoped to responsibility, not just visibility.",
  },
  {
    value: "100%",
    label: "evidence-linked public summary basis",
    detail:
      "Only finalized reconciliation is eligible for public-safe publication.",
  },
  {
    value: "2",
    label: "demo event tracks",
    detail:
      "One open operational flow and one closed publish-ready flow keep the foundation honest.",
  },
  {
    value: "4",
    label: "core confidence states",
    detail:
      "Verified, warning, restricted, and exception states are expressed consistently.",
  },
] as const;

export const trustPillars = [
  {
    title: "Public-safe by design",
    description:
      "The interface distinguishes what can be published from what must remain protected, instead of treating all finance data as equal.",
  },
  {
    title: "Evidence before narrative",
    description:
      "Registration income, manual income, expense settlement, and approval actions are presented as traceable operational records.",
  },
  {
    title: "Readable under pressure",
    description:
      "Information hierarchy favors clarity, reviewability, and calm decision-making over decorative density or dashboard noise.",
  },
] as const;

export const publicEventCards = [
  {
    title: "Demo Open Finance Workshop 2026",
    slug: "demo-open-finance-workshop-2026",
    status: "Published",
    registrationState: "Open",
    dateLabel: "15 Jun 2026",
    description:
      "An active event used to demonstrate live registration, payment-proof verification, and request intake workflows.",
    seatsLabel: "128 seats remaining",
  },
  {
    title: "Demo CSE Annual Tech Symposium 2026",
    slug: "demo-cse-annual-tech-symposium-2026",
    status: "Closed",
    registrationState: "Closed",
    dateLabel: "25 Jan 2026",
    description:
      "A closed event with verified income, settled expense, finalized reconciliation, and an already published public summary.",
    seatsLabel: "Finalized operational records",
  },
] as const;

export const publishedSummaries = [
  {
    title: "Demo CSE Annual Tech Symposium 2026",
    slug: "demo-cse-annual-tech-symposium-2026",
    publishedAt: "09 Apr 2026",
    totals: {
      collected: "4,250",
      spent: "1,800",
      closingBalance: "2,450",
    },
    breakdown: {
      registrationIncome: "1,250",
      manualIncome: "3,000",
      settledExpense: "1,800",
    },
    note:
      "Summary-only view derived from finalized reconciliation. No proof files or internal reviewer notes are exposed.",
  },
] as const;

export const disclosureBoundary = {
  publicIncluded: [
    "Published totals, timing, status, and high-level breakdowns.",
    "Event identity, reconciliation status, and public-safe financial summary snapshots.",
    "Clarity notes about what is counted and when publication becomes valid.",
  ],
  publicExcluded: [
    "Payment proof files, reference artifacts, and uploaded evidence paths.",
    "Private reviewer notes, complaint evidence, and protected routing detail.",
    "Draft or pending internal numbers that have not passed reconciliation and publish controls.",
  ],
} as const;

export const dashboardMetrics = [
  {
    label: "Active verification queue",
    value: "01",
    detail: "One payment proof is waiting for finance review.",
  },
  {
    label: "Published public summaries",
    value: "01",
    detail: "A finalized reconciliation has already crossed the publish boundary.",
  },
  {
    label: "Pending approval items",
    value: "01",
    detail: "One request is staged for a decision without breaking self-approval rules.",
  },
  {
    label: "Latest reconciliation state",
    value: "Finalized",
    detail: "The closed symposium flow is ready for public-safe reading.",
  },
] as const;

export const verificationQueueRows = [
  {
    participant: "Demo Active Student",
    event: "Demo Open Finance Workshop 2026",
    channel: "bKash",
    amount: "500.00",
    state: "Pending verification",
    submittedAt: "09 Apr 2026",
  },
] as const;

export const approvalQueueRows = [
  {
    entityType: "Budget request",
    event: "Demo Open Finance Workshop 2026",
    amount: "1,200.00",
    state: "Submitted",
    requester: "Demo Event Manager",
    note: "Banner and volunteer kit request waiting for approver action.",
  },
] as const;

export const internalSignals = [
  {
    title: "Verification queue stays evidence-aware",
    description:
      "Finance reviewers see the participant context and proof metadata they need, without mixing public-safe views with internal handling.",
  },
  {
    title: "Approval queue stays decision-first",
    description:
      "Approvers review the request, the requester, and the decision history while preserving separation of duties.",
  },
  {
    title: "Publication stays gated",
    description:
      "The interface keeps the public release boundary visible so draft and internal-only data never feels one click away from publication.",
  },
] as const;

export const controlShowcaseRows = [
  {
    signal: "Request state",
    representation: "Submitted",
    rationale:
      "Signals that the requester can no longer silently overwrite the record.",
  },
  {
    signal: "Evidence coverage",
    representation: "Attached PDF",
    rationale:
      "Shows there is a document anchor without leaking storage paths.",
  },
  {
    signal: "Publish readiness",
    representation: "Blocked until finalized",
    rationale:
      "Keeps public disclosure tied to reconciliation status.",
  },
] as const;

export const auditChecklist = [
  "Role-aware navigation distinguishes public-safe reading from protected operations.",
  "State components clearly show healthy, blocked, loading, and empty conditions.",
  "Tables and forms share one calm, restrained visual language instead of mixing patterns.",
  "Landing pages and dashboard pages feel related, but not visually identical.",
] as const;
