import {
  AccountStatus,
  ApprovalDecisionType,
  ApprovalEntityType,
  BudgetState,
  EventStatus,
  ExpenseRecordState,
  Prisma,
  RequestState,
  RoleCode,
} from "@prisma/client";

import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { auditService } from "../src/modules/audit/services/audit.service";
import { approvalsService } from "../src/modules/approvals/services/approvals.service";
import { approvalsRepository } from "../src/modules/approvals/repositories/approvals.repository";
import { approvalDecisionSchema } from "../src/modules/approvals/validations/approvals.validation";
import { budgetsService } from "../src/modules/budgets/services/budgets.service";
import { budgetsRepository } from "../src/modules/budgets/repositories/budgets.repository";
import { createBudgetSchema } from "../src/modules/budgets/validations/budgets.validation";
import { eventsRepository } from "../src/modules/events/repositories/events.repository";
import {
  mapBudgetRequest,
  mapExpenseRequest,
} from "../src/modules/requests/requests.mappers";
import { requestsRepository } from "../src/modules/requests/repositories/requests.repository";
import { requestsService } from "../src/modules/requests/services/requests.service";
import {
  createBudgetRequestSchema,
  createExpenseRequestSchema,
  updateBudgetRequestSchema,
  updateExpenseRequestSchema,
} from "../src/modules/requests/validations/requests.validation";
import { storageProvider } from "../src/storage";
import type { AuthenticatedUser } from "../src/types/auth";
import { AppError } from "../src/utils/app-error";

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

function makeCuid(seed: string) {
  const normalized = seed.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `c${normalized.padEnd(24, "a").slice(0, 24)}`;
}

function createUser(
  id: string,
  roles: RoleCode[],
  fullName: string,
): AuthenticatedUser {
  return {
    id,
    fullName,
    email: `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    status: AccountStatus.ACTIVE,
    roles,
  };
}

function createSupportingDocument(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: makeCuid("supportingdocument"),
    category: "SUPPORTING_DOCUMENT",
    originalName: "receipt.pdf",
    mimeType: "application/pdf",
    sizeBytes: BigInt(1024),
    createdAt: new Date("2026-04-07T10:00:00.000Z"),
    ...overrides,
  };
}

function createApprovalDecision(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: makeCuid("approvaldecision"),
    entityType: ApprovalEntityType.BUDGET_REQUEST,
    decision: ApprovalDecisionType.APPROVED,
    comment: null,
    createdAt: new Date("2026-04-07T11:00:00.000Z"),
    actor: {
      id: makeCuid("approver"),
      fullName: "Approver",
      email: "approver@example.com",
    },
    ...overrides,
  };
}

function createEventSummary(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: makeCuid("event"),
    title: "Finance Fest",
    slug: "finance-fest",
    status: EventStatus.PUBLISHED,
    ...overrides,
  };
}

function createBudgetContext(overrides: Partial<Record<string, unknown>> = {}) {
  const event = createEventSummary();
  const createdBy = {
    id: makeCuid("finance"),
    fullName: "Finance Controller",
    email: "finance@example.com",
  };

  return {
    id: makeCuid("budget"),
    eventId: event.id,
    version: 2,
    title: "Budget v2",
    state: BudgetState.APPROVED,
    totalAmount: new Prisma.Decimal("1500.75"),
    isActive: true,
    createdAt: new Date("2026-04-07T09:00:00.000Z"),
    updatedAt: new Date("2026-04-07T09:00:00.000Z"),
    event,
    createdBy,
    items: [
      {
        id: makeCuid("budgetitem"),
        category: "Venue",
        label: "Hall booking",
        amount: new Prisma.Decimal("1500.75"),
        notes: "Main auditorium",
      },
    ],
    ...overrides,
  };
}

function createBudgetRequestContext(overrides: Partial<Record<string, unknown>> = {}) {
  const event = createEventSummary();
  const requestedBy = {
    id: makeCuid("requester"),
    fullName: "Event Manager",
    email: "event.manager@example.com",
  };

  return {
    id: makeCuid("budgetrequest"),
    eventId: event.id,
    requestedById: requestedBy.id,
    amount: new Prisma.Decimal("800.00"),
    purpose: "Stage and logistics",
    justification: "Needed for the event setup",
    state: RequestState.SUBMITTED,
    createdAt: new Date("2026-04-07T10:00:00.000Z"),
    updatedAt: new Date("2026-04-07T10:00:00.000Z"),
    event,
    requestedBy,
    documents: [createSupportingDocument()],
    approvalDecisions: [createApprovalDecision()],
    ...overrides,
  };
}

function createExpenseRequestContext(overrides: Partial<Record<string, unknown>> = {}) {
  const event = createEventSummary();
  const requestedBy = {
    id: makeCuid("requester"),
    fullName: "Event Manager",
    email: "event.manager@example.com",
  };

  return {
    id: makeCuid("expenserequest"),
    eventId: event.id,
    requestedById: requestedBy.id,
    amount: new Prisma.Decimal("550.50"),
    category: "Transport",
    purpose: "Volunteer transport",
    justification: "Required to move volunteers",
    state: RequestState.SUBMITTED,
    createdAt: new Date("2026-04-07T10:30:00.000Z"),
    updatedAt: new Date("2026-04-07T10:30:00.000Z"),
    event,
    requestedBy,
    documents: [createSupportingDocument()],
    approvalDecisions: [
      createApprovalDecision({
        entityType: ApprovalEntityType.EXPENSE_REQUEST,
      }),
    ],
    expenseRecords: [
      {
        id: makeCuid("linkedexpenserecord"),
        amount: new Prisma.Decimal("300.00"),
        category: "Transport",
        state: ExpenseRecordState.SETTLED,
        paidAt: new Date("2026-04-07T12:00:00.000Z"),
        createdAt: new Date("2026-04-07T12:00:00.000Z"),
      },
    ],
    ...overrides,
  };
}

function createExpenseRecordContext(overrides: Partial<Record<string, unknown>> = {}) {
  const event = createEventSummary();
  const recordedBy = {
    id: makeCuid("finance"),
    fullName: "Finance Controller",
    email: "finance@example.com",
  };
  const expenseRequest = {
    id: makeCuid("approvedrequest"),
    amount: new Prisma.Decimal("550.50"),
    category: "Transport",
    purpose: "Volunteer transport",
    state: RequestState.APPROVED,
    requestedBy: {
      id: makeCuid("requester"),
      fullName: "Event Manager",
      email: "event.manager@example.com",
    },
  };

  return {
    id: makeCuid("expenserecord"),
    eventId: event.id,
    expenseRequestId: expenseRequest.id,
    amount: new Prisma.Decimal("550.50"),
    category: "Transport",
    description: "Van rental settled",
    state: ExpenseRecordState.SETTLED,
    paidAt: new Date("2026-04-07T13:00:00.000Z"),
    createdAt: new Date("2026-04-07T13:00:00.000Z"),
    updatedAt: new Date("2026-04-07T13:00:00.000Z"),
    event,
    recordedBy,
    expenseRequest,
    documents: [createSupportingDocument()],
    ...overrides,
  };
}

function createUploadFile(overrides: Partial<Express.Multer.File> = {}) {
  return {
    fieldname: "supportingDocument",
    originalname: "proof.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    size: 2048,
    buffer: Buffer.from("demo-file"),
    destination: "",
    filename: "",
    path: "",
    stream: undefined as never,
    ...overrides,
  } as Express.Multer.File;
}

function assertCondition(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectAppError(
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
      `${label}: expected status ${statusCode}, received ${error.statusCode}.`,
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

async function checkRoute(
  baseUrl: string,
  input: {
    label: string;
    path: string;
    method?: string;
    expectedStatus: number;
  },
): Promise<CheckResult> {
  const response = await fetch(`${baseUrl}${input.path}`, {
    method: input.method ?? "GET",
  });

  return {
    label: input.label,
    ok: response.status === input.expectedStatus,
    details: `${input.method ?? "GET"} ${input.path} -> ${response.status}`,
  };
}

async function runCheck(label: string, runner: () => Promise<string>): Promise<CheckResult> {
  try {
    return {
      label,
      ok: true,
      details: await runner(),
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    return {
      label,
      ok: false,
      details,
    };
  }
}

async function main() {
  ensureEnvDefaults();

  const results: CheckResult[] = [];
  const financeActor = createUser(
    makeCuid("financeactor"),
    [RoleCode.FINANCIAL_CONTROLLER],
    "Finance Controller",
  );
  const approverActor = createUser(
    makeCuid("approveractor"),
    [RoleCode.ORGANIZATIONAL_APPROVER],
    "Organizational Approver",
  );
  const eventManagerActor = createUser(
    makeCuid("eventmanager"),
    [RoleCode.EVENT_MANAGEMENT_USER],
    "Event Manager",
  );

  const app = createApp();
  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind the verification server to a local port.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    results.push(
      ...(await Promise.all([
        checkRoute(baseUrl, {
          label: "Budgets route requires authentication",
          path: "/api/budgets",
          expectedStatus: 401,
        }),
        checkRoute(baseUrl, {
          label: "Budget request route requires authentication",
          path: "/api/requests/budget-requests/mine",
          expectedStatus: 401,
        }),
        checkRoute(baseUrl, {
          label: "Expense record route requires authentication",
          path: "/api/requests/expense-records",
          expectedStatus: 401,
        }),
        checkRoute(baseUrl, {
          label: "Approval queue route requires authentication",
          path: "/api/approvals/queue",
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
    await runCheck("Budget validation rejects empty items and zero amounts", async () => {
      createBudgetSchema.parse({
        body: {
          eventId: makeCuid("event1"),
          title: "Main budget",
          items: [{ category: "Venue", label: "Hall", amount: "1200.50" }],
        },
      });

      let rejected = false;

      try {
        createBudgetSchema.parse({
          body: {
            eventId: makeCuid("event1"),
            items: [{ category: "Venue", label: "Hall", amount: "0" }],
          },
        });
      } catch {
        rejected = true;
      }

      assertCondition(rejected, "Budget item validation accepted a zero amount.");

      rejected = false;

      try {
        createBudgetSchema.parse({
          body: {
            eventId: makeCuid("event1"),
            items: [],
          },
        });
      } catch {
        rejected = true;
      }

      assertCondition(rejected, "Budget validation accepted an empty item list.");
      return "budget item validation is enforcing positive amounts and non-empty item lists";
    }),
  );

  results.push(
    await runCheck("Request validation rejects zero amounts", async () => {
      createBudgetRequestSchema.parse({
        body: {
          eventId: makeCuid("event2"),
          amount: "150.00",
          purpose: "Venue support",
        },
      });
      createExpenseRequestSchema.parse({
        body: {
          eventId: makeCuid("event2"),
          amount: "180.25",
          category: "Transport",
          purpose: "Volunteer movement",
        },
      });

      let rejected = false;

      try {
        createBudgetRequestSchema.parse({
          body: {
            eventId: makeCuid("event2"),
            amount: "0",
            purpose: "Venue support",
          },
        });
      } catch {
        rejected = true;
      }

      assertCondition(rejected, "Budget request validation accepted a zero amount.");

      rejected = false;

      try {
        createExpenseRequestSchema.parse({
          body: {
            eventId: makeCuid("event2"),
            amount: "0.00",
            category: "Transport",
            purpose: "Volunteer movement",
          },
        });
      } catch {
        rejected = true;
      }

      assertCondition(rejected, "Expense request validation accepted a zero amount.");
      return "budget and expense request validation is enforcing positive amounts";
    }),
  );

  results.push(
    await runCheck("Request update validation remains compatible with file-only updates", async () => {
      updateBudgetRequestSchema.parse({
        params: {
          budgetRequestId: makeCuid("budgetrequestid"),
        },
        body: {},
      });

      updateExpenseRequestSchema.parse({
        params: {
          expenseRequestId: makeCuid("expenserequestid"),
        },
        body: {},
      });

      return "zod validation allows empty PATCH bodies so service-level file-only updates can work";
    }),
  );

  results.push(
    await runCheck("Approval validation requires remarks for reject and return", async () => {
      approvalDecisionSchema.parse({
        params: {
          entityType: ApprovalEntityType.BUDGET_REQUEST,
          entityId: makeCuid("approvalentity"),
        },
        body: {
          decision: ApprovalDecisionType.APPROVED,
        },
      });

      let rejected = false;

      try {
        approvalDecisionSchema.parse({
          params: {
            entityType: ApprovalEntityType.EXPENSE_REQUEST,
            entityId: makeCuid("approvalentity"),
          },
          body: {
            decision: ApprovalDecisionType.RETURNED,
          },
        });
      } catch {
        rejected = true;
      }

      assertCondition(rejected, "Approval validation accepted a return decision without remarks.");
      return "approval validation is requiring remarks for reject and return decisions";
    }),
  );

  results.push(
    await runCheck("Budget revision creates a new version and preserves history", async () => {
      const baseBudget = createBudgetContext();
      const revisedItems = [
        { category: "Venue", label: "Hall", amount: "1200.50", notes: "Updated hall cost" },
        { category: "Tech", label: "Sound", amount: "300.25" },
      ];
      let markedBudgetId: string | null = null;
      let createdBudgetInput: Record<string, unknown> | null = null;
      const auditEntries: Array<Record<string, unknown>> = [];

      const result = await withPatches(
        [
          {
            target: budgetsRepository as unknown as Record<string, unknown>,
            key: "findById",
            value: async () => baseBudget,
          },
          {
            target: budgetsRepository as unknown as Record<string, unknown>,
            key: "findLatestBudgetVersion",
            value: async () => baseBudget,
          },
          {
            target: budgetsRepository as unknown as Record<string, unknown>,
            key: "markBudgetRevised",
            value: async (budgetId: string) => {
              markedBudgetId = budgetId;
              return {
                ...baseBudget,
                state: BudgetState.REVISED,
                isActive: false,
              };
            },
          },
          {
            target: budgetsRepository as unknown as Record<string, unknown>,
            key: "createBudget",
            value: async (input: Record<string, unknown>) => {
              createdBudgetInput = input;
              return createBudgetContext({
                id: makeCuid("newbudgetversion"),
                version: input.version,
                title: input.title,
                state: input.state,
                isActive: false,
                totalAmount: new Prisma.Decimal(String(input.totalAmount)),
                items: revisedItems.map((item, index) => ({
                  id: makeCuid(`reviseditem${index}`),
                  category: item.category,
                  label: item.label,
                  amount: new Prisma.Decimal(item.amount),
                  notes: item.notes ?? null,
                })),
              });
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
            value: async (entry: Record<string, unknown>) => {
              auditEntries.push(entry);
            },
          },
        ],
        async () =>
          budgetsService.createBudgetRevision(
            financeActor,
            baseBudget.id,
            {
              title: "Budget v3",
              items: revisedItems,
            },
            {
              route: "/api/budgets",
              method: "POST",
            },
          ),
      );

      assertCondition(markedBudgetId === baseBudget.id, "Previous budget version was not marked as revised.");
      assertCondition(createdBudgetInput?.version === 3, "Budget revision did not increment the version.");
      assertCondition(result.version === 3, "Returned revision did not expose the new version.");
      assertCondition(
        result.totalAmount === "1500.75",
        `Expected revised total to be 1500.75, received ${result.totalAmount}.`,
      );
      assertCondition(auditEntries.length === 1, "Budget revision was not audit logged.");

      await expectAppError(
        "Budget invalid state transition",
        () =>
          withPatches(
            [
              {
                target: budgetsRepository as unknown as Record<string, unknown>,
                key: "findById",
                value: async () => baseBudget,
              },
            ],
            async () =>
              budgetsService.updateBudgetState(financeActor, baseBudget.id, {
                state: BudgetState.DRAFT,
              }),
          ),
        409,
        "cannot transition",
      );

      return "budget revisions create a new version, mark the old one revised, and block invalid direct state rewrites";
    }),
  );

  results.push(
    await runCheck("Budget request document linkage is preserved", async () => {
      const createdDocuments: Array<Record<string, unknown>> = [];
      const auditEntries: Array<Record<string, unknown>> = [];

      const request = await withPatches(
        [
          {
            target: eventsRepository as unknown as Record<string, unknown>,
            key: "findById",
            value: async () => createEventSummary(),
          },
          {
            target: storageProvider as unknown as Record<string, unknown>,
            key: "saveFile",
            value: async () => ({
              storedName: "stored-budget-request-proof.pdf",
              relativePath: "supporting-documents/stored-budget-request-proof.pdf",
            }),
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "createBudgetRequest",
            value: async () => ({
              id: makeCuid("createdbudgetrequest"),
            }),
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "createSupportingDocument",
            value: async (input: Record<string, unknown>) => {
              createdDocuments.push(input);
              return {
                id: makeCuid("createdsupportingdocument"),
              };
            },
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "findBudgetRequestById",
            value: async () =>
              createBudgetRequestContext({
                id: makeCuid("createdbudgetrequest"),
                approvalDecisions: [],
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
        async () =>
          requestsService.createBudgetRequest(
            eventManagerActor,
            {
              eventId: makeCuid("event3"),
              amount: "420.00",
              purpose: "Stage setup",
            },
            createUploadFile(),
            {
              route: "/api/requests/budget-requests",
              method: "POST",
            },
          ),
      );

      assertCondition(createdDocuments.length === 1, "Budget request supporting document was not created.");
      assertCondition(
        createdDocuments[0].budgetRequestId === makeCuid("createdbudgetrequest"),
        "Budget request supporting document was not linked to the created request.",
      );
      assertCondition(request.documents.length === 1, "Budget request response did not include the linked document.");
      assertCondition(auditEntries.length === 1, "Budget request creation was not audit logged.");
      return "budget request file metadata is stored and linked to the request without leaking storage paths";
    }),
  );

  results.push(
    await runCheck("Request update flow blocks silent no-op overwrites", async () => {
      await expectAppError(
        "Budget request no-op update",
        () =>
          withPatches(
            [
              {
                target: requestsRepository as unknown as Record<string, unknown>,
                key: "findBudgetRequestById",
                value: async () =>
                  createBudgetRequestContext({
                    requestedById: eventManagerActor.id,
                    state: RequestState.RETURNED,
                  }),
              },
            ],
            async () =>
              requestsService.updateBudgetRequest(
                eventManagerActor,
                makeCuid("budgetrequest4"),
                {},
                undefined,
              ),
          ),
        400,
        "supporting document",
      );

      await expectAppError(
        "Expense request no-op update",
        () =>
          withPatches(
            [
              {
                target: requestsRepository as unknown as Record<string, unknown>,
                key: "findExpenseRequestById",
                value: async () =>
                  createExpenseRequestContext({
                    requestedById: eventManagerActor.id,
                    state: RequestState.RETURNED,
                    documents: [createSupportingDocument()],
                  }),
              },
            ],
            async () =>
              requestsService.updateExpenseRequest(
                eventManagerActor,
                makeCuid("expenserequest4"),
                {},
                undefined,
              ),
          ),
        400,
        "supporting document",
      );

      return "service-level checks prevent empty update payloads from silently overwriting request records";
    }),
  );

  results.push(
    await runCheck("Expense request document rules remain strict but allow file-only recovery", async () => {
      await expectAppError(
        "Expense request missing document",
        () =>
          requestsService.createExpenseRequest(
            eventManagerActor,
            {
              eventId: makeCuid("event5"),
              amount: "180.00",
              category: "Transport",
              purpose: "Volunteer movement",
            },
            undefined,
          ),
        400,
        "supporting document",
      );

      const createdDocuments: Array<Record<string, unknown>> = [];
      let findExpenseRequestCallCount = 0;

      const request = await withPatches(
        [
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "findExpenseRequestById",
            value: async () => {
              findExpenseRequestCallCount += 1;

              if (findExpenseRequestCallCount === 1) {
                return createExpenseRequestContext({
                  id: makeCuid("returnedexpenserequest"),
                  requestedById: eventManagerActor.id,
                  state: RequestState.RETURNED,
                  documents: [createSupportingDocument()],
                  approvalDecisions: [],
                  expenseRecords: [],
                });
              }

              return createExpenseRequestContext({
                id: makeCuid("returnedexpenserequest"),
                requestedById: eventManagerActor.id,
                state: RequestState.RETURNED,
                documents: [createSupportingDocument({ id: makeCuid("newrequestdocument") })],
                approvalDecisions: [],
                expenseRecords: [],
              });
            },
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "updateExpenseRequest",
            value: async () => createExpenseRequestContext(),
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "createSupportingDocument",
            value: async (input: Record<string, unknown>) => {
              createdDocuments.push(input);
              return {
                id: makeCuid("newrequestdocument"),
              };
            },
          },
          {
            target: storageProvider as unknown as Record<string, unknown>,
            key: "saveFile",
            value: async () => ({
              storedName: "stored-expense-request-proof.pdf",
              relativePath: "supporting-documents/stored-expense-request-proof.pdf",
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
            value: async () => undefined,
          },
        ],
        async () =>
          requestsService.updateExpenseRequest(
            eventManagerActor,
            makeCuid("returnedexpenserequest"),
            {},
            createUploadFile({
              originalname: "replacement-proof.pdf",
            }),
          ),
      );

      assertCondition(
        createdDocuments.length === 1 &&
          createdDocuments[0].expenseRequestId === makeCuid("returnedexpenserequest"),
        "Expense request file-only update did not persist a linked supporting document.",
      );
      assertCondition(request.documents.length === 1, "Expense request response did not include the linked replacement document.");
      return "expense requests still require evidence, and returned requests can recover with a document-only update";
    }),
  );

  results.push(
    await runCheck("Expense record flow stays separate from expense requests", async () => {
      await expectAppError(
        "Expense record missing linkage and file",
        () =>
          withPatches(
            [
              {
                target: eventsRepository as unknown as Record<string, unknown>,
                key: "findById",
                value: async () => createEventSummary(),
              },
            ],
            async () =>
              requestsService.createExpenseRecord(
                financeActor,
                {
                  eventId: makeCuid("event6"),
                  amount: "90.00",
                  category: "Food",
                  description: "Volunteer snacks",
                },
                undefined,
              ),
          ),
        400,
        "approved expense request",
      );

      await expectAppError(
        "Expense record linked to non-approved request",
        () =>
          withPatches(
            [
              {
                target: eventsRepository as unknown as Record<string, unknown>,
                key: "findById",
                value: async () => createEventSummary(),
              },
              {
                target: requestsRepository as unknown as Record<string, unknown>,
                key: "findExpenseRequestById",
                value: async () =>
                  createExpenseRequestContext({
                    id: makeCuid("submittedexpenserequest"),
                    eventId: makeCuid("event6"),
                    state: RequestState.SUBMITTED,
                    expenseRecords: [],
                    approvalDecisions: [],
                  }),
              },
            ],
            async () =>
              requestsService.createExpenseRecord(
                financeActor,
                {
                  eventId: makeCuid("event6"),
                  expenseRequestId: makeCuid("submittedexpenserequest"),
                  amount: "90.00",
                  category: "Food",
                  description: "Volunteer snacks",
                },
                undefined,
              ),
          ),
        409,
        "approved expense requests",
      );

      let createdDocuments = 0;

      const linkedRecord = await withPatches(
        [
          {
            target: eventsRepository as unknown as Record<string, unknown>,
            key: "findById",
            value: async () => createEventSummary({ id: makeCuid("event7") }),
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "findExpenseRequestById",
            value: async () =>
              createExpenseRequestContext({
                id: makeCuid("approvedexpenserequest"),
                eventId: makeCuid("event7"),
                state: RequestState.APPROVED,
                expenseRecords: [],
                approvalDecisions: [],
              }),
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "createExpenseRecord",
            value: async () => ({
              id: makeCuid("linkedexpenserecord"),
            }),
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "createSupportingDocument",
            value: async () => {
              createdDocuments += 1;
              return {};
            },
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "findExpenseRecordById",
            value: async () =>
              createExpenseRecordContext({
                id: makeCuid("linkedexpenserecord"),
                eventId: makeCuid("event7"),
                expenseRequest: {
                  id: makeCuid("approvedexpenserequest"),
                  amount: new Prisma.Decimal("550.50"),
                  category: "Transport",
                  purpose: "Volunteer transport",
                  state: RequestState.APPROVED,
                  requestedBy: {
                    id: eventManagerActor.id,
                    fullName: eventManagerActor.fullName,
                    email: eventManagerActor.email,
                  },
                },
                documents: [],
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
            value: async () => undefined,
          },
        ],
        async () =>
          requestsService.createExpenseRecord(
            financeActor,
            {
              eventId: makeCuid("event7"),
              expenseRequestId: makeCuid("approvedexpenserequest"),
              amount: "300.00",
              category: "Transport",
              description: "Van rental settled",
            },
            undefined,
          ),
      );

      assertCondition(createdDocuments === 0, "Linked expense record unexpectedly required a new supporting document.");
      assertCondition(
        linkedRecord.expenseRequest?.id === makeCuid("approvedexpenserequest"),
        "Expense record did not remain linked to the approved request.",
      );

      createdDocuments = 0;

      const uploadedRecord = await withPatches(
        [
          {
            target: eventsRepository as unknown as Record<string, unknown>,
            key: "findById",
            value: async () => createEventSummary({ id: makeCuid("event8") }),
          },
          {
            target: storageProvider as unknown as Record<string, unknown>,
            key: "saveFile",
            value: async () => ({
              storedName: "expense-record-proof.pdf",
              relativePath: "supporting-documents/expense-record-proof.pdf",
            }),
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "createExpenseRecord",
            value: async () => ({
              id: makeCuid("uploaddedexpenserecord"),
            }),
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "createSupportingDocument",
            value: async (input: Record<string, unknown>) => {
              createdDocuments += 1;
              assertCondition(
                input.expenseRecordId === makeCuid("uploaddedexpenserecord"),
                "Expense record supporting document was not linked to the record.",
              );
              return {};
            },
          },
          {
            target: requestsRepository as unknown as Record<string, unknown>,
            key: "findExpenseRecordById",
            value: async () =>
              createExpenseRecordContext({
                id: makeCuid("uploaddedexpenserecord"),
                eventId: makeCuid("event8"),
                expenseRequest: null,
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
            value: async () => undefined,
          },
        ],
        async () =>
          requestsService.createExpenseRecord(
            financeActor,
            {
              eventId: makeCuid("event8"),
              amount: "215.00",
              category: "Logistics",
              description: "Equipment transport",
              paidAt: new Date("2026-04-07T14:00:00.000Z"),
            },
            createUploadFile({
              originalname: "expense-record-proof.pdf",
            }),
          ),
      );

      assertCondition(createdDocuments === 1, "Standalone expense record did not persist a supporting document.");
      assertCondition(
        uploadedRecord.state === ExpenseRecordState.SETTLED,
        "Expense record with paidAt should start in the settled state.",
      );

      return "expense requests and settled expense records stay separate, with document rules enforced on each path";
    }),
  );

  results.push(
    await runCheck("Approval queue access control and self-approval blocking work", async () => {
      await expectAppError(
        "Approval queue non-approver access",
        async () => approvalsService.listApprovalQueue(eventManagerActor, {}),
        403,
        "not allowed",
      );

      await expectAppError(
        "Budget self-approval",
        () =>
          withPatches(
            [
              {
                target: approvalsRepository as unknown as Record<string, unknown>,
                key: "findBudgetRequestById",
                value: async () =>
                  createBudgetRequestContext({
                    requestedById: approverActor.id,
                    state: RequestState.SUBMITTED,
                    approvalDecisions: [],
                  }),
              },
            ],
            async () =>
              approvalsService.decide(
                approverActor,
                ApprovalEntityType.BUDGET_REQUEST,
                makeCuid("selfapprovalbudget"),
                {
                  decision: ApprovalDecisionType.APPROVED,
                },
              ),
          ),
        409,
        "Self-approval",
      );

      return "approval queue is blocked for non-approvers and self-approval is rejected";
    }),
  );

  results.push(
    await runCheck("Approval decisions preserve actor, remarks, timestamps, transitions, and audit logging", async () => {
      const createdDecisionInputs: Array<Record<string, unknown>> = [];
      const auditEntries: Array<Record<string, unknown>> = [];

      const approvedBudget = await withPatches(
        [
          {
            target: approvalsRepository as unknown as Record<string, unknown>,
            key: "findBudgetRequestById",
            value: async () =>
              createBudgetRequestContext({
                id: makeCuid("budgetapprovalrequest"),
                requestedById: eventManagerActor.id,
                state: RequestState.SUBMITTED,
                approvalDecisions: [],
              }),
          },
          {
            target: approvalsRepository as unknown as Record<string, unknown>,
            key: "createApprovalDecision",
            value: async (input: Record<string, unknown>) => {
              createdDecisionInputs.push(input);
              return createApprovalDecision({
                actor: {
                  id: approverActor.id,
                  fullName: approverActor.fullName,
                  email: approverActor.email,
                },
              });
            },
          },
          {
            target: approvalsRepository as unknown as Record<string, unknown>,
            key: "updateBudgetRequestState",
            value: async () =>
              createBudgetRequestContext({
                id: makeCuid("budgetapprovalrequest"),
                requestedById: eventManagerActor.id,
                state: RequestState.APPROVED,
                approvalDecisions: [
                  createApprovalDecision({
                    actor: {
                      id: approverActor.id,
                      fullName: approverActor.fullName,
                      email: approverActor.email,
                    },
                    comment: null,
                  }),
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
        async () =>
          approvalsService.decide(
            approverActor,
            ApprovalEntityType.BUDGET_REQUEST,
            makeCuid("budgetapprovalrequest"),
            {
              decision: ApprovalDecisionType.APPROVED,
            },
            {
              route: "/api/approvals",
              method: "POST",
            },
          ),
      );

      assertCondition(
        createdDecisionInputs[0].actorId === approverActor.id &&
          createdDecisionInputs[0].budgetRequestId === makeCuid("budgetapprovalrequest"),
        "Budget approval decision did not preserve the approver identity and target request.",
      );
      assertCondition(
        approvedBudget.request.state === RequestState.APPROVED,
        "Budget approval did not transition the request to APPROVED.",
      );

      const returnedExpense = await withPatches(
        [
          {
            target: approvalsRepository as unknown as Record<string, unknown>,
            key: "findExpenseRequestById",
            value: async () =>
              createExpenseRequestContext({
                id: makeCuid("expenseapprovalrequest"),
                requestedById: eventManagerActor.id,
                state: RequestState.SUBMITTED,
                approvalDecisions: [],
                expenseRecords: [],
              }),
          },
          {
            target: approvalsRepository as unknown as Record<string, unknown>,
            key: "createApprovalDecision",
            value: async (input: Record<string, unknown>) => {
              createdDecisionInputs.push(input);
              return createApprovalDecision({
                entityType: ApprovalEntityType.EXPENSE_REQUEST,
                decision: ApprovalDecisionType.RETURNED,
                comment: "Please attach the signed receipt.",
                actor: {
                  id: approverActor.id,
                  fullName: approverActor.fullName,
                  email: approverActor.email,
                },
              });
            },
          },
          {
            target: approvalsRepository as unknown as Record<string, unknown>,
            key: "updateExpenseRequestState",
            value: async () =>
              createExpenseRequestContext({
                id: makeCuid("expenseapprovalrequest"),
                requestedById: eventManagerActor.id,
                state: RequestState.RETURNED,
                expenseRecords: [],
                approvalDecisions: [
                  createApprovalDecision({
                    entityType: ApprovalEntityType.EXPENSE_REQUEST,
                    decision: ApprovalDecisionType.RETURNED,
                    comment: "Please attach the signed receipt.",
                    actor: {
                      id: approverActor.id,
                      fullName: approverActor.fullName,
                      email: approverActor.email,
                    },
                  }),
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
        async () =>
          approvalsService.decide(
            approverActor,
            ApprovalEntityType.EXPENSE_REQUEST,
            makeCuid("expenseapprovalrequest"),
            {
              decision: ApprovalDecisionType.RETURNED,
              comment: "Please attach the signed receipt.",
            },
            {
              route: "/api/approvals",
              method: "POST",
            },
          ),
      );

      assertCondition(
        createdDecisionInputs[1].comment === "Please attach the signed receipt." &&
          createdDecisionInputs[1].actorId === approverActor.id &&
          createdDecisionInputs[1].expenseRequestId === makeCuid("expenseapprovalrequest"),
        "Expense approval return decision did not preserve remarks and approver identity.",
      );
      assertCondition(
        returnedExpense.request.state === RequestState.RETURNED,
        "Expense approval return decision did not transition the request to RETURNED.",
      );
      assertCondition(
        returnedExpense.request.approvalDecisions[0]?.actor.id === approverActor.id &&
          returnedExpense.request.approvalDecisions[0]?.comment === "Please attach the signed receipt." &&
          returnedExpense.request.approvalDecisions[0]?.createdAt instanceof Date,
        "Expense approval response did not expose actor, remarks, and timestamp history.",
      );
      assertCondition(auditEntries.length === 2, "Approval actions were not audit logged.");

      const mappedBudget = mapBudgetRequest(
        createBudgetRequestContext({
          approvalDecisions: [
            createApprovalDecision({
              actor: {
                id: approverActor.id,
                fullName: approverActor.fullName,
                email: approverActor.email,
              },
              comment: "Looks good",
            }),
          ],
        }) as never,
      );
      const mappedExpense = mapExpenseRequest(
        createExpenseRequestContext({
          approvalDecisions: [
            createApprovalDecision({
              entityType: ApprovalEntityType.EXPENSE_REQUEST,
              decision: ApprovalDecisionType.REJECTED,
              comment: "Need a stronger justification",
              actor: {
                id: approverActor.id,
                fullName: approverActor.fullName,
                email: approverActor.email,
              },
            }),
          ],
        }) as never,
      );

      assertCondition(
        mappedBudget.approvalDecisions[0]?.actor.email === approverActor.email &&
          mappedExpense.approvalDecisions[0]?.createdAt instanceof Date,
        "Approval response shaping lost actor identity or decision timestamps.",
      );

      return "approval decisions preserve actor identity, remarks, timestamps, transitions, and audit history";
    }),
  );

  for (const result of results) {
    const prefix = result.ok ? "[ok]" : "[fail]";
    console.log(`${prefix} ${result.label}: ${result.details}`);
  }

  const failedChecks = results.filter((result) => !result.ok);

  if (failedChecks.length > 0) {
    throw new Error("Finance workflow slice verification failed.");
  }

  console.log("Finance workflow slice verification passed.");
}

void main().catch((error) => {
  console.error("Finance workflow verification failed.", error);
  process.exit(1);
});
