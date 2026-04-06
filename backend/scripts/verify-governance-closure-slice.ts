import {
  AccountStatus,
  ComplaintState,
  DocumentCategory,
  EventStatus,
  ExpenseRecordState,
  IncomeState,
  Prisma,
  PublicSummaryStatus,
  ReconciliationState,
  RoleCode,
} from "@prisma/client";

import type { AuthenticatedUser } from "../src/types/auth";

type CheckResult = {
  label: string;
  ok: boolean;
  details: string;
};

type PatchEntry = {
  target: Record<string, unknown>;
  key: string;
  value: unknown;
};

function ensureEnvDefaults() {
  process.env.NODE_ENV ??= "development";
  process.env.PORT ??= "4000";
  process.env.FRONTEND_URL ??= "http://localhost:3000";
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/mu_cse_transparency";
  process.env.JWT_ACCESS_SECRET ??= "replace-with-long-random-access-secret";
  process.env.JWT_REFRESH_SECRET ??= "replace-with-long-random-refresh-secret";
  process.env.ACCESS_TOKEN_TTL ??= "15m";
  process.env.REFRESH_TOKEN_TTL ??= "7d";
  process.env.ACCESS_TOKEN_COOKIE_NAME ??= "mu_access_token";
  process.env.REFRESH_TOKEN_COOKIE_NAME ??= "mu_refresh_token";
  process.env.BCRYPT_SALT_ROUNDS ??= "12";
  process.env.UPLOADS_ROOT ??= "uploads";
}

async function loadModules() {
  ensureEnvDefaults();

  const [
    appModule,
    appErrorModule,
    prismaModule,
    auditModule,
    complaintsServiceModule,
    complaintsRepositoryModule,
    complaintsMapperModule,
    complaintsValidationModule,
    eventsRepositoryModule,
    rolesRepositoryModule,
    reconciliationServiceModule,
    reconciliationRepositoryModule,
    reconciliationMapperModule,
    publicServiceModule,
    publicRepositoryModule,
    publicMapperModule,
    auditServiceModule,
    auditRepositoryModule,
  ] = await Promise.all([
    import("../src/app"),
    import("../src/utils/app-error"),
    import("../src/config/prisma"),
    import("../src/modules/audit/services/audit.service"),
    import("../src/modules/complaints/services/complaints.service"),
    import("../src/modules/complaints/repositories/complaints.repository"),
    import("../src/modules/complaints/complaints.mappers"),
    import("../src/modules/complaints/validations/complaints.validation"),
    import("../src/modules/events/repositories/events.repository"),
    import("../src/modules/roles/repositories/roles.repository"),
    import("../src/modules/reconciliation/services/reconciliation.service"),
    import("../src/modules/reconciliation/repositories/reconciliation.repository"),
    import("../src/modules/reconciliation/reconciliation.mappers"),
    import("../src/modules/public/services/public.service"),
    import("../src/modules/public/repositories/public.repository"),
    import("../src/modules/public/public.mappers"),
    import("../src/modules/audit/services/audit.service"),
    import("../src/modules/audit/repositories/audit.repository"),
  ]);

  return {
    createApp: appModule.createApp,
    AppError: appErrorModule.AppError,
    prisma: prismaModule.prisma,
    auditService: auditModule.auditService,
    complaintsService: complaintsServiceModule.complaintsService,
    complaintsRepository: complaintsRepositoryModule.complaintsRepository,
    mapComplaintForReview: complaintsMapperModule.mapComplaintForReview,
    mapComplaintForSubmitter: complaintsMapperModule.mapComplaintForSubmitter,
    createComplaintSchema: complaintsValidationModule.createComplaintSchema,
    routeComplaintSchema: complaintsValidationModule.routeComplaintSchema,
    escalateComplaintSchema: complaintsValidationModule.escalateComplaintSchema,
    eventsRepository: eventsRepositoryModule.eventsRepository,
    rolesRepository: rolesRepositoryModule.rolesRepository,
    reconciliationService: reconciliationServiceModule.reconciliationService,
    reconciliationRepository: reconciliationRepositoryModule.reconciliationRepository,
    mapReconciliationReport: reconciliationMapperModule.mapReconciliationReport,
    publicService: publicServiceModule.publicService,
    publicRepository: publicRepositoryModule.publicRepository,
    mapPublicFinancialSummary: publicMapperModule.mapPublicFinancialSummary,
    protectedAuditService: auditServiceModule.auditService,
    auditRepository: auditRepositoryModule.auditRepository,
  };
}

type LoadedModules = Awaited<ReturnType<typeof loadModules>>;

function makeCuid(seed: string) {
  const normalized = seed.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `c${normalized.padEnd(24, "a").slice(0, 24)}`;
}

function createUser(id: string, roles: RoleCode[], fullName: string): AuthenticatedUser {
  return {
    id,
    fullName,
    email: `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    status: AccountStatus.ACTIVE,
    roles,
  };
}

function createEvent(status: EventStatus = EventStatus.COMPLETED) {
  return {
    id: makeCuid("event"),
    title: "Governance Fest",
    slug: "governance-fest",
    status,
  };
}

function createRole(code: RoleCode) {
  return {
    id: makeCuid(`role${code}`),
    code,
    name: code.replaceAll("_", " "),
  };
}

function createEvidence(overrides: Record<string, unknown> = {}) {
  return {
    id: makeCuid("evidence"),
    category: DocumentCategory.COMPLAINT_EVIDENCE,
    originalName: "complaint-evidence.pdf",
    mimeType: "application/pdf",
    storedName: "private-stored-name.pdf",
    relativePath: "complaint-evidence/private-stored-name.pdf",
    sizeBytes: BigInt(4096),
    createdAt: new Date("2026-04-07T08:00:00.000Z"),
    ...overrides,
  };
}

function createRouting(
  state: ComplaintState,
  note: string | null = "Internal reviewer note",
  toRole: RoleCode = RoleCode.COMPLAINT_REVIEW_AUTHORITY,
) {
  return {
    id: makeCuid(`routing${state}`),
    complaintId: makeCuid("complaint"),
    state,
    note,
    createdAt: new Date("2026-04-07T09:00:00.000Z"),
    fromRole: createRole(RoleCode.COMPLAINT_REVIEW_AUTHORITY),
    toRole: createRole(toRole),
    routedBy: {
      id: makeCuid("reviewer"),
      fullName: "Complaint Reviewer",
      email: "complaint.reviewer@example.com",
    },
  };
}

function createComplaintContext(overrides: Record<string, unknown> = {}) {
  const submittedBy = {
    id: makeCuid("student"),
    fullName: "General Student",
    email: "student@example.com",
  };

  return {
    id: makeCuid("complaint"),
    eventId: makeCuid("event"),
    submittedById: submittedBy.id,
    subject: "Budget publication concern",
    description: "The published event expense summary is unclear.",
    state: ComplaintState.SUBMITTED,
    createdAt: new Date("2026-04-07T08:00:00.000Z"),
    updatedAt: new Date("2026-04-07T08:00:00.000Z"),
    event: createEvent(),
    submittedBy,
    documents: [createEvidence()],
    routings: [],
    ...overrides,
  };
}

function createReportContext(overrides: Record<string, unknown> = {}) {
  const payload = {
    warnings: [],
    breakdown: {
      verifiedRegistrationIncome: "100.00",
      manualIncome: "250.00",
      settledExpense: "120.00",
      verifiedPaymentProofCount: 2,
      verifiedPaymentProofsMissingAmount: 1,
      manualIncomeRecordCount: 2,
      unverifiedManualIncomeRecordCount: 1,
      settledExpenseRecordCount: 1,
      pendingExpenseRecordCount: 1,
      approvedExpenseRequestsWithoutSettledRecord: 1,
    },
  };

  return {
    id: makeCuid("reconciliationreport"),
    eventId: makeCuid("event"),
    status: ReconciliationState.DRAFT,
    totalIncome: new Prisma.Decimal("350.00"),
    totalExpense: new Prisma.Decimal("120.00"),
    closingBalance: new Prisma.Decimal("230.00"),
    warnings: payload,
    generatedById: makeCuid("finance"),
    reviewedById: null,
    createdAt: new Date("2026-04-07T10:00:00.000Z"),
    finalizedAt: null,
    event: createEvent(),
    generatedBy: {
      id: makeCuid("finance"),
      fullName: "Finance Controller",
      email: "finance@example.com",
    },
    reviewedBy: null,
    publicSummarySnapshots: [],
    ...overrides,
  };
}

function createPublicSummaryContext(overrides: Record<string, unknown> = {}) {
  return {
    id: makeCuid("publicsummary"),
    eventId: makeCuid("event"),
    reconciliationReportId: makeCuid("reconciliationreport"),
    status: PublicSummaryStatus.PUBLISHED,
    publishedById: makeCuid("approver"),
    publishedAt: new Date("2026-04-07T12:00:00.000Z"),
    totalCollected: new Prisma.Decimal("350.00"),
    totalSpent: new Prisma.Decimal("120.00"),
    closingBalance: new Prisma.Decimal("230.00"),
    payload: {
      basis: "FINALIZED_RECONCILIATION",
      summaryOnly: true,
      privateReviewerNote: "must not leak",
      paymentProofIds: ["secret-proof"],
      breakdown: {
        registrationIncome: "100.00",
        manualIncome: "250.00",
        settledExpense: "120.00",
      },
    },
    event: createEvent(),
    reconciliationReport: {
      id: makeCuid("reconciliationreport"),
      status: ReconciliationState.FINALIZED,
      finalizedAt: new Date("2026-04-07T11:00:00.000Z"),
      createdAt: new Date("2026-04-07T10:00:00.000Z"),
    },
    ...overrides,
  };
}

async function withPatches<T>(entries: PatchEntry[], runner: () => Promise<T>) {
  const originals = entries.map((entry) => ({
    target: entry.target,
    key: entry.key,
    value: entry.target[entry.key],
  }));

  for (const entry of entries) {
    entry.target[entry.key] = entry.value;
  }

  try {
    return await runner();
  } finally {
    for (const original of originals) {
      original.target[original.key] = original.value;
    }
  }
}

function assertCondition(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectAppError(
  AppError: LoadedModules["AppError"],
  label: string,
  runner: () => Promise<unknown>,
  statusCode: number,
  messageIncludes?: string,
) {
  try {
    await runner();
  } catch (error) {
    assertCondition(error instanceof AppError, `${label}: expected an AppError.`);
    assertCondition(
      error.statusCode === statusCode,
      `${label}: expected ${statusCode}, received ${error.statusCode}.`,
    );

    if (messageIncludes) {
      assertCondition(
        error.message.includes(messageIncludes),
        `${label}: expected message to include "${messageIncludes}", received "${error.message}".`,
      );
    }

    return;
  }

  throw new Error(`${label}: expected service call to fail.`);
}

function assertNoSensitiveKeys(value: unknown, label: string) {
  const json = JSON.stringify(value);
  const forbidden = [
    "relativePath",
    "storedName",
    "privateReviewerNote",
    "paymentProofIds",
    "reviewerRemark",
    "complaint",
    "description",
    "evidence",
  ];

  for (const key of forbidden) {
    assertCondition(!json.includes(key), `${label}: leaked ${key}.`);
  }
}

async function runCheck(label: string, runner: () => Promise<string>): Promise<CheckResult> {
  try {
    return {
      label,
      ok: true,
      details: await runner(),
    };
  } catch (error) {
    return {
      label,
      ok: false,
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkRoute(
  baseUrl: string,
  input: { label: string; path: string; expectedStatus: number },
): Promise<CheckResult> {
  const response = await fetch(`${baseUrl}${input.path}`);

  return {
    label: input.label,
    ok: response.status === input.expectedStatus,
    details: `GET ${input.path} -> ${response.status}`,
  };
}

async function main() {
  const modules = await loadModules();
  const {
    AppError,
    auditRepository,
    auditService,
    complaintsRepository,
    complaintsService,
    createApp,
    createComplaintSchema,
    escalateComplaintSchema,
    eventsRepository,
    mapComplaintForReview,
    mapComplaintForSubmitter,
    mapPublicFinancialSummary,
    mapReconciliationReport,
    prisma,
    protectedAuditService,
    publicRepository,
    publicService,
    reconciliationRepository,
    reconciliationService,
    rolesRepository,
    routeComplaintSchema,
  } = modules;

  const results: CheckResult[] = [];
  const student = createUser(makeCuid("student"), [RoleCode.GENERAL_STUDENT], "General Student");
  const reviewer = createUser(
    makeCuid("reviewer"),
    [RoleCode.COMPLAINT_REVIEW_AUTHORITY],
    "Complaint Reviewer",
  );
  const finance = createUser(
    makeCuid("finance"),
    [RoleCode.FINANCIAL_CONTROLLER],
    "Finance Controller",
  );
  const approver = createUser(
    makeCuid("approver"),
    [RoleCode.ORGANIZATIONAL_APPROVER],
    "Organizational Approver",
  );
  const admin = createUser(makeCuid("admin"), [RoleCode.SYSTEM_ADMIN], "System Admin");

  const app = createApp();
  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind verification server.");
  }

  try {
    const baseUrl = `http://127.0.0.1:${address.port}`;
    results.push(
      ...(await Promise.all([
        checkRoute(baseUrl, {
          label: "Complaint review queue requires authentication",
          path: "/api/complaints/review-queue",
          expectedStatus: 401,
        }),
        checkRoute(baseUrl, {
          label: "Reconciliation route requires authentication",
          path: "/api/reconciliation",
          expectedStatus: 401,
        }),
        checkRoute(baseUrl, {
          label: "Audit list route requires authentication",
          path: "/api/audit",
          expectedStatus: 401,
        }),
      ])),
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  results.push(
    await runCheck("Complaint submission validation", async () => {
      createComplaintSchema.parse({
        body: {
          eventId: makeCuid("event"),
          subject: "Payment concern",
          description: "The payment verification process needs a clearer explanation.",
        },
      });

      let rejected = false;

      try {
        createComplaintSchema.parse({
          body: {
            subject: "No",
            description: "short",
          },
        });
      } catch {
        rejected = true;
      }

      assertCondition(rejected, "Invalid complaint submission payload was accepted.");
      return "complaint submission accepts valid intake and rejects weak subject/description";
    }),
  );

  results.push(
    await runCheck("Complaint review queue access control", async () => {
      await expectAppError(
        AppError,
        "Non-reviewer complaint queue access",
        () => complaintsService.listReviewQueue(student, {}),
        403,
        "not allowed",
      );

      const queue = await withPatches(
        [
          {
            target: complaintsRepository as unknown as Record<string, unknown>,
            key: "listReviewQueue",
            value: async () => [
              createComplaintContext({
                state: ComplaintState.ESCALATED,
                routings: [
                  createRouting(
                    ComplaintState.ESCALATED,
                    "Escalated for final decision",
                    RoleCode.ORGANIZATIONAL_APPROVER,
                  ),
                ],
              }),
            ],
          },
        ],
        async () => complaintsService.listReviewQueue(reviewer, {}),
      );

      assertCondition(queue.length === 1 && queue[0].isEscalated, "Reviewer queue did not expose expected escalated item.");
      assertCondition(queue[0].evidenceCount === 1, "Queue should expose evidence count only.");
      return "review queue is role-gated and exposes safe queue metadata";
    }),
  );

  results.push(
    await runCheck("Complaint routing and escalation history", async () => {
      routeComplaintSchema.parse({
        params: { complaintId: makeCuid("complaint") },
        body: {
          toRoleCode: RoleCode.COMPLAINT_REVIEW_AUTHORITY,
          note: "Route to review authority",
        },
      });
      escalateComplaintSchema.parse({
        params: { complaintId: makeCuid("complaint") },
        body: {
          toRoleCode: RoleCode.ORGANIZATIONAL_APPROVER,
          note: "Escalate to approver",
        },
      });

      const routingHistory: Array<Record<string, unknown>> = [];
      const auditEntries: Array<Record<string, unknown>> = [];
      let callCount = 0;

      const escalatedComplaint = await withPatches(
        [
          {
            target: complaintsRepository as unknown as Record<string, unknown>,
            key: "findComplaintById",
            value: async () => {
              callCount += 1;
              return createComplaintContext({
                state: callCount === 1 ? ComplaintState.UNDER_REVIEW : ComplaintState.ROUTED,
              });
            },
          },
          {
            target: rolesRepository as unknown as Record<string, unknown>,
            key: "syncCatalog",
            value: async () => undefined,
          },
          {
            target: rolesRepository as unknown as Record<string, unknown>,
            key: "findByCode",
            value: async (roleCode: RoleCode) => createRole(roleCode),
          },
          {
            target: complaintsRepository as unknown as Record<string, unknown>,
            key: "createRoutingHistory",
            value: async (input: Record<string, unknown>) => {
              routingHistory.push(input);
            },
          },
          {
            target: complaintsRepository as unknown as Record<string, unknown>,
            key: "updateComplaintState",
            value: async (_id: string, state: ComplaintState) =>
              createComplaintContext({
                state,
                routings: [
                  createRouting(ComplaintState.ROUTED, "Route to review authority"),
                  createRouting(
                    ComplaintState.ESCALATED,
                    "Escalate to approver",
                    RoleCode.ORGANIZATIONAL_APPROVER,
                  ),
                ],
              }),
          },
          {
            target: prisma as unknown as Record<string, unknown>,
            key: "$transaction",
            value: async (callback: (client: unknown) => Promise<unknown>) => callback({}),
          },
          {
            target: auditService as unknown as Record<string, unknown>,
            key: "record",
            value: async (entry: Record<string, unknown>) => {
              auditEntries.push(entry);
            },
          },
        ],
        async () => {
          await complaintsService.routeComplaint(reviewer, makeCuid("complaint"), {
            toRoleCode: RoleCode.COMPLAINT_REVIEW_AUTHORITY,
            note: "Route to review authority",
          });

          return complaintsService.escalateComplaint(reviewer, makeCuid("complaint"), {
            toRoleCode: RoleCode.ORGANIZATIONAL_APPROVER,
            note: "Escalate to approver",
          });
        },
      );

      assertCondition(routingHistory.length === 2, "Routing history entries were not preserved.");
      assertCondition(routingHistory[1].state === ComplaintState.ESCALATED, "Escalation history did not capture ESCALATED state.");
      assertCondition(escalatedComplaint.routingHistory.length === 2, "Mapped complaint did not expose routing history.");
      assertCondition(auditEntries.length === 2, "Complaint route/escalate actions were not audited.");
      return "route and escalate transitions append history with reviewer identity and notes";
    }),
  );

  results.push(
    await runCheck("Complaint resolve and close lifecycle behavior", async () => {
      let state = ComplaintState.UNDER_REVIEW;
      const transitions: ComplaintState[] = [];

      await withPatches(
        [
          {
            target: complaintsRepository as unknown as Record<string, unknown>,
            key: "findComplaintById",
            value: async () => createComplaintContext({ state }),
          },
          {
            target: rolesRepository as unknown as Record<string, unknown>,
            key: "syncCatalog",
            value: async () => undefined,
          },
          {
            target: rolesRepository as unknown as Record<string, unknown>,
            key: "findByCode",
            value: async (roleCode: RoleCode) => createRole(roleCode),
          },
          {
            target: complaintsRepository as unknown as Record<string, unknown>,
            key: "createRoutingHistory",
            value: async () => undefined,
          },
          {
            target: complaintsRepository as unknown as Record<string, unknown>,
            key: "updateComplaintState",
            value: async (_id: string, nextState: ComplaintState) => {
              state = nextState;
              transitions.push(nextState);
              return createComplaintContext({ state: nextState });
            },
          },
          {
            target: prisma as unknown as Record<string, unknown>,
            key: "$transaction",
            value: async (callback: (client: unknown) => Promise<unknown>) => callback({}),
          },
          {
            target: auditService as unknown as Record<string, unknown>,
            key: "record",
            value: async () => undefined,
          },
        ],
        async () => {
          await complaintsService.resolveComplaint(reviewer, makeCuid("complaint"), {
            note: "Resolved after review",
          });

          await complaintsService.closeComplaint(reviewer, makeCuid("complaint"), {
            note: "Closed after acknowledgement",
          });
        },
      );

      await expectAppError(
        AppError,
        "Invalid complaint close transition",
        () =>
          withPatches(
            [
              {
                target: complaintsRepository as unknown as Record<string, unknown>,
                key: "findComplaintById",
                value: async () => createComplaintContext({ state: ComplaintState.SUBMITTED }),
              },
            ],
            async () => complaintsService.closeComplaint(reviewer, makeCuid("complaint"), {}),
          ),
        409,
        "cannot transition",
      );

      assertCondition(
        transitions.join(",") === `${ComplaintState.RESOLVED},${ComplaintState.CLOSED}`,
        "Resolve/close lifecycle did not follow RESOLVED -> CLOSED.",
      );
      return "complaints can move to resolved then closed, and invalid close jumps are blocked";
    }),
  );

  results.push(
    await runCheck("Complaint evidence metadata stays protected", async () => {
      const complaint = createComplaintContext({
        routings: [createRouting(ComplaintState.ROUTED, "Sensitive reviewer note")],
      });
      const submitterView = mapComplaintForSubmitter(complaint as never);
      const reviewerView = mapComplaintForReview(complaint as never);

      assertCondition(
        submitterView.routingHistory[0]?.note === null,
        "Submitter view leaked routing notes.",
      );
      assertCondition(
        !("relativePath" in submitterView.evidence[0]) && !("storedName" in reviewerView.evidence[0]),
        "Evidence response leaked storage metadata.",
      );
      return "complaint evidence exposes safe metadata only, and submitter view hides internal routing notes";
    }),
  );

  results.push(
    await runCheck("Reconciliation generation totals and warnings", async () => {
      const createdReports: Array<Record<string, unknown>> = [];

      const report = await withPatches(
        [
          {
            target: eventsRepository as unknown as Record<string, unknown>,
            key: "findById",
            value: async () => createEvent(),
          },
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "listVerifiedPaymentProofs",
            value: async () => [
              { id: makeCuid("proof1"), amount: new Prisma.Decimal("100.00"), registrationId: makeCuid("registration1") },
              { id: makeCuid("proof2"), amount: null, registrationId: makeCuid("registration2") },
            ],
          },
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "countVerifiedRegistrations",
            value: async () => 3,
          },
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "listManualIncomeRecords",
            value: async () => [
              { id: makeCuid("income1"), amount: new Prisma.Decimal("200.00"), state: IncomeState.VERIFIED },
              { id: makeCuid("income2"), amount: new Prisma.Decimal("50.00"), state: IncomeState.RECORDED },
            ],
          },
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "listExpenseRecords",
            value: async () => [
              { id: makeCuid("expense1"), amount: new Prisma.Decimal("120.00"), state: ExpenseRecordState.SETTLED },
              { id: makeCuid("expense2"), amount: new Prisma.Decimal("80.00"), state: ExpenseRecordState.RECORDED },
            ],
          },
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "listApprovedExpenseRequests",
            value: async () => [
              { id: makeCuid("request1"), amount: new Prisma.Decimal("120.00"), expenseRecords: [{ id: makeCuid("expense1"), state: ExpenseRecordState.SETTLED }] },
              { id: makeCuid("request2"), amount: new Prisma.Decimal("80.00"), expenseRecords: [] },
            ],
          },
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "createReport",
            value: async (input: Record<string, unknown>) => {
              createdReports.push(input);
              return createReportContext({
                totalIncome: new Prisma.Decimal(String(input.totalIncome)),
                totalExpense: new Prisma.Decimal(String(input.totalExpense)),
                closingBalance: new Prisma.Decimal(String(input.closingBalance)),
                warnings: input.payload,
              });
            },
          },
          {
            target: auditService as unknown as Record<string, unknown>,
            key: "record",
            value: async () => undefined,
          },
        ],
        async () => reconciliationService.generateReport(finance, { eventId: makeCuid("event") }),
      );

      const warningCodes = report.warnings.map((warning) => warning.code);

      assertCondition(createdReports[0].totalIncome === "350.00", "Reconciliation total income is incorrect.");
      assertCondition(createdReports[0].totalExpense === "120.00", "Reconciliation total expense is incorrect.");
      assertCondition(createdReports[0].closingBalance === "230.00", "Reconciliation closing balance is incorrect.");
      assertCondition(
        warningCodes.includes("VERIFIED_PAYMENT_PROOF_MISSING_AMOUNT") &&
          warningCodes.includes("VERIFIED_REGISTRATION_WITHOUT_VERIFIED_PROOF") &&
          warningCodes.includes("MANUAL_INCOME_NOT_VERIFIED") &&
          warningCodes.includes("EXPENSE_RECORD_NOT_SETTLED") &&
          warningCodes.includes("APPROVED_EXPENSE_REQUEST_WITHOUT_SETTLEMENT"),
        "Expected reconciliation warnings were not surfaced.",
      );
      assertCondition(report.status === ReconciliationState.DRAFT, "Generated reconciliation should start as draft.");
      return "reconciliation totals come from verified proof income, manual income, settled expenses, and visible warnings";
    }),
  );

  results.push(
    await runCheck("Draft, reviewed, and finalized reconciliation distinctions", async () => {
      let latestReportId = makeCuid("reconciliationreport");
      let currentStatus = ReconciliationState.DRAFT;
      const statusUpdates: ReconciliationState[] = [];

      await withPatches(
        [
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "findReportById",
            value: async () => createReportContext({ id: latestReportId, status: currentStatus }),
          },
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "findLatestReportForEvent",
            value: async () => createReportContext({ id: latestReportId, status: currentStatus }),
          },
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "updateReportStatus",
            value: async (_id: string, input: { status: ReconciliationState; finalizedAt?: Date }) => {
              currentStatus = input.status;
              statusUpdates.push(input.status);
              return createReportContext({
                id: latestReportId,
                status: input.status,
                reviewedBy: input.status === ReconciliationState.REVIEWED ? { id: finance.id, fullName: finance.fullName, email: finance.email } : null,
                finalizedAt: input.finalizedAt ?? null,
              });
            },
          },
          {
            target: auditService as unknown as Record<string, unknown>,
            key: "record",
            value: async () => undefined,
          },
        ],
        async () => {
          const reviewed = await reconciliationService.reviewReport(finance, latestReportId);
          assertCondition(reviewed.status === ReconciliationState.REVIEWED, "Review did not produce REVIEWED status.");

          const finalized = await reconciliationService.finalizeReport(approver, latestReportId);
          assertCondition(finalized.status === ReconciliationState.FINALIZED, "Finalize did not produce FINALIZED status.");
        },
      );

      latestReportId = makeCuid("olderreport");
      await expectAppError(
        AppError,
        "Finalize draft reconciliation",
        () =>
          withPatches(
            [
              {
                target: reconciliationRepository as unknown as Record<string, unknown>,
                key: "findReportById",
                value: async () => createReportContext({ id: latestReportId, status: ReconciliationState.DRAFT }),
              },
            ],
            async () => reconciliationService.finalizeReport(approver, latestReportId),
          ),
        409,
        "reviewed",
      );

      assertCondition(
        statusUpdates.join(",") === `${ReconciliationState.REVIEWED},${ReconciliationState.FINALIZED}`,
        "Reconciliation lifecycle did not follow DRAFT -> REVIEWED -> FINALIZED.",
      );
      return "reconciliation lifecycle distinguishes draft, reviewed, and finalized states";
    }),
  );

  results.push(
    await runCheck("Public summary publish gating and summary-only response", async () => {
      await expectAppError(
        AppError,
        "Publish non-finalized reconciliation",
        () =>
          withPatches(
            [
              {
                target: reconciliationRepository as unknown as Record<string, unknown>,
                key: "findReportById",
                value: async () => createReportContext({ status: ReconciliationState.REVIEWED }),
              },
            ],
            async () => publicService.publishFinancialSummary(approver, makeCuid("reconciliationreport")),
          ),
        409,
        "finalized",
      );

      await expectAppError(
        AppError,
        "Publish before event completion",
        () =>
          withPatches(
            [
              {
                target: reconciliationRepository as unknown as Record<string, unknown>,
                key: "findReportById",
                value: async () =>
                  createReportContext({
                    status: ReconciliationState.FINALIZED,
                    event: createEvent(EventStatus.PUBLISHED),
                    finalizedAt: new Date("2026-04-07T11:00:00.000Z"),
                  }),
              },
            ],
            async () => publicService.publishFinancialSummary(approver, makeCuid("reconciliationreport")),
          ),
        409,
        "completed or closed",
      );

      const published = await withPatches(
        [
          {
            target: reconciliationRepository as unknown as Record<string, unknown>,
            key: "findReportById",
            value: async () =>
              createReportContext({
                status: ReconciliationState.FINALIZED,
                finalizedAt: new Date("2026-04-07T11:00:00.000Z"),
                event: createEvent(EventStatus.COMPLETED),
              }),
          },
          {
            target: publicRepository as unknown as Record<string, unknown>,
            key: "findPublishedSummaryByReportId",
            value: async () => null,
          },
          {
            target: publicRepository as unknown as Record<string, unknown>,
            key: "createPublishedSummary",
            value: async (input: Record<string, unknown>) =>
              createPublicSummaryContext({
                totalCollected: new Prisma.Decimal(String(input.totalCollected)),
                totalSpent: new Prisma.Decimal(String(input.totalSpent)),
                closingBalance: new Prisma.Decimal(String(input.closingBalance)),
                payload: input.payload,
              }),
          },
          {
            target: auditService as unknown as Record<string, unknown>,
            key: "record",
            value: async () => undefined,
          },
        ],
        async () => publicService.publishFinancialSummary(approver, makeCuid("reconciliationreport")),
      );

      assertCondition(published.payload?.summaryOnly === true, "Public summary payload is not marked summary-only.");
      assertNoSensitiveKeys(published, "Published public summary");

      const mappedWithExtraPayload = mapPublicFinancialSummary(createPublicSummaryContext() as never);
      assertNoSensitiveKeys(mappedWithExtraPayload, "Mapped public summary");
      assertCondition(
        Object.keys(mappedWithExtraPayload.payload?.breakdown ?? {}).join(",") ===
          "registrationIncome,manualIncome,settledExpense",
        "Public payload mapper did not whitelist summary breakdown fields.",
      );
      return "public summary publish requires finalized reconciliation and completed/closed event, and output is summary-only";
    }),
  );

  results.push(
    await runCheck("Audit list/detail views are protected and role-gated", async () => {
      await expectAppError(
        AppError,
        "Non-admin audit list access",
        () => protectedAuditService.listAuditLogs(student, { limit: 20 }),
        403,
        "audit",
      );

      const auditLog = {
        id: makeCuid("auditlog"),
        actorId: admin.id,
        action: "complaints.transition",
        entityType: "Complaint",
        entityId: makeCuid("complaint"),
        summary: "Moved complaint to UNDER_REVIEW",
        context: { previousState: ComplaintState.SUBMITTED },
        ipAddress: "127.0.0.1",
        userAgent: "verification",
        route: "/api/complaints",
        method: "POST",
        createdAt: new Date("2026-04-07T12:00:00.000Z"),
        actor: {
          id: admin.id,
          fullName: admin.fullName,
          email: admin.email,
        },
      };

      const [logs, detail] = await withPatches(
        [
          {
            target: auditRepository as unknown as Record<string, unknown>,
            key: "list",
            value: async () => [auditLog],
          },
          {
            target: auditRepository as unknown as Record<string, unknown>,
            key: "findById",
            value: async () => auditLog,
          },
        ],
        async () =>
          Promise.all([
            protectedAuditService.listAuditLogs(admin, { limit: 20 }),
            protectedAuditService.getAuditLogById(admin, auditLog.id),
          ]),
      );

      assertCondition(logs.length === 1 && detail?.id === auditLog.id, "Admin audit list/detail did not return expected safe data.");
      return "audit list/detail are service-gated to admin access";
    }),
  );

  results.push(
    await runCheck("Internal mappers avoid public sensitive leaks", async () => {
      const reconciliation = mapReconciliationReport(
        createReportContext({
          warnings: {
            warnings: [{ code: "TEST_WARNING", severity: "warning", message: "Visible warning" }],
            breakdown: {
              verifiedRegistrationIncome: "100.00",
              manualIncome: "50.00",
              settledExpense: "25.00",
            },
          },
        }) as never,
      );

      assertCondition(reconciliation.warnings.length === 1, "Reconciliation warning did not map through.");

      const submitterComplaint = mapComplaintForSubmitter(
        createComplaintContext({
          routings: [createRouting(ComplaintState.ROUTED, "Private routing note")],
        }) as never,
      );

      assertCondition(submitterComplaint.routingHistory[0]?.note === null, "Submitter complaint view leaked private routing note.");
      return "reconciliation warnings stay visible while public and submitter-safe views stay redacted";
    }),
  );

  for (const result of results) {
    const prefix = result.ok ? "[ok]" : "[fail]";
    console.log(`${prefix} ${result.label}: ${result.details}`);
  }

  const failedChecks = results.filter((result) => !result.ok);

  if (failedChecks.length > 0) {
    throw new Error("Governance closure slice verification failed.");
  }

  console.log("Governance closure slice verification passed.");
}

void main().catch((error) => {
  console.error("Governance closure verification failed.", error);
  process.exit(1);
});
