import bcrypt from "bcryptjs";
import {
  AccountStatus,
  ApprovalDecisionType,
  ApprovalEntityType,
  BudgetState,
  DocumentCategory,
  EventStatus,
  ExpenseRecordState,
  IncomeSourceType,
  IncomeState,
  PaymentProofState,
  RequestState,
  RoleCode,
  StorageDisk,
} from "@prisma/client";

import { documentDirectories } from "../src/config/uploads";
import { prisma } from "../src/config/prisma";
import { publicRepository } from "../src/modules/public/repositories/public.repository";
import { publicService } from "../src/modules/public/services/public.service";
import { reconciliationRepository } from "../src/modules/reconciliation/repositories/reconciliation.repository";
import { reconciliationService } from "../src/modules/reconciliation/services/reconciliation.service";
import { roleCatalog } from "../src/modules/roles/role-catalog";
import { storageProvider } from "../src/storage";
import type { AuthenticatedUser } from "../src/types/auth";
import { normalizeEmail } from "../src/utils/normalize-email";

const demoPassword = "DemoPass123!";
const demoActiveEventSlug = "demo-open-finance-workshop-2026";
const demoClosedEventSlug = "demo-cse-annual-tech-symposium-2026";

type DemoUserInput = {
  fullName: string;
  email: string;
  password?: string;
  roles: RoleCode[];
};

type DemoBudgetItemInput = {
  category: string;
  label: string;
  amount: string;
  notes?: string;
};

type DemoSupportingLinkField =
  | "paymentProofId"
  | "incomeRecordId"
  | "budgetRequestId"
  | "expenseRequestId"
  | "expenseRecordId";

type DemoSupportingDocumentInput = {
  category: DocumentCategory;
  destinationDir: string;
  relationField: DemoSupportingLinkField;
  relationId: string;
  originalName: string;
  uploadedById?: string;
  bodyLabel: string;
};

function moneyTotal(items: DemoBudgetItemInput[]) {
  return items
    .reduce((sum, item) => sum + Number(item.amount), 0)
    .toFixed(2);
}

function buildAuthUser(
  user: { id: string; fullName: string; email: string },
  roles: RoleCode[],
): AuthenticatedUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    status: AccountStatus.ACTIVE,
    roles,
  };
}

function buildDemoPdfBuffer(label: string) {
  return Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj
2 0 obj
<< /Length 45 >>
stream
Demo document for ${label}
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF`,
    "utf8",
  );
}

async function ensureRoleCatalog() {
  for (const role of roleCatalog) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
  }
}

async function ensureUser(input: DemoUserInput) {
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password ?? demoPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      fullName: input.fullName,
      passwordHash,
      status: AccountStatus.ACTIVE,
    },
    create: {
      fullName: input.fullName,
      email: normalizedEmail,
      passwordHash,
      status: AccountStatus.ACTIVE,
    },
  });

  for (const roleCode of input.roles) {
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
    });

    if (!role) {
      throw new Error(`Role ${roleCode} was not found while seeding demo data.`);
    }

    const existingAssignment = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
        revokedAt: null,
      },
    });

    if (!existingAssignment) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }
  }

  return user;
}

async function ensureEvent(input: {
  title: string;
  slug: string;
  description: string;
  status: EventStatus;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  capacity: number | null;
  createdById: string;
}) {
  return prisma.event.upsert({
    where: { slug: input.slug },
    update: {
      title: input.title,
      description: input.description,
      status: input.status,
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      createdById: input.createdById,
    },
    create: input,
  });
}

async function ensureRegistration(input: {
  eventId: string;
  participantId: string;
  participantName: string;
  studentId: string;
  email: string;
  phone: string;
  registrationCode: string;
  paymentState: "PAYMENT_PENDING" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
}) {
  return prisma.registration.upsert({
    where: {
      eventId_studentId: {
        eventId: input.eventId,
        studentId: input.studentId,
      },
    },
    update: {
      participantId: input.participantId,
      participantName: input.participantName,
      email: input.email,
      phone: input.phone,
      registrationCode: input.registrationCode,
      paymentState: input.paymentState,
    },
    create: input,
  });
}

async function ensureLinkedDemoDocument(input: DemoSupportingDocumentInput) {
  const existingDocument = await prisma.supportingDocument.findFirst({
    where: {
      [input.relationField]: input.relationId,
      originalName: input.originalName,
    },
  });

  if (existingDocument) {
    return existingDocument;
  }

  const buffer = buildDemoPdfBuffer(input.bodyLabel);
  const storedFile = await storageProvider.saveFile({
    buffer,
    destinationDir: input.destinationDir,
    originalName: input.originalName,
  });

  return prisma.supportingDocument.create({
    data: {
      category: input.category,
      storageDisk: StorageDisk.LOCAL,
      originalName: input.originalName,
      mimeType: "application/pdf",
      storedName: storedFile.storedName,
      relativePath: storedFile.relativePath,
      sizeBytes: BigInt(buffer.length),
      uploadedById: input.uploadedById,
      [input.relationField]: input.relationId,
    },
  });
}

async function ensurePaymentProof(input: {
  registrationId: string;
  externalChannel: string;
  transactionReference: string;
  referenceText: string;
  amount: string;
  state: PaymentProofState;
  reviewedAt?: Date;
  reviewerRemark?: string;
  reviewedById?: string;
}) {
  const existingProof = await prisma.paymentProof.findFirst({
    where: {
      transactionReference: input.transactionReference,
    },
  });

  if (existingProof) {
    return prisma.paymentProof.update({
      where: { id: existingProof.id },
      data: {
        registrationId: input.registrationId,
        externalChannel: input.externalChannel,
        transactionReference: input.transactionReference,
        referenceText: input.referenceText,
        amount: input.amount,
        state: input.state,
        reviewedAt: input.reviewedAt ?? null,
        reviewerRemark: input.reviewerRemark ?? null,
        reviewedById: input.reviewedById ?? null,
      },
    });
  }

  return prisma.paymentProof.create({
    data: {
      registrationId: input.registrationId,
      externalChannel: input.externalChannel,
      transactionReference: input.transactionReference,
      referenceText: input.referenceText,
      amount: input.amount,
      state: input.state,
      reviewedAt: input.reviewedAt,
      reviewerRemark: input.reviewerRemark,
      reviewedById: input.reviewedById,
    },
  });
}

async function ensureIncomeRecord(input: {
  eventId: string;
  sourceType: IncomeSourceType;
  sourceLabel: string;
  amount: string;
  referenceText: string;
  collectedAt: Date;
  state: IncomeState;
  recordedById: string;
  verifiedById?: string;
}) {
  const existingIncomeRecord = await prisma.incomeRecord.findFirst({
    where: {
      eventId: input.eventId,
      sourceLabel: input.sourceLabel,
    },
  });

  if (existingIncomeRecord) {
    return prisma.incomeRecord.update({
      where: { id: existingIncomeRecord.id },
      data: {
        sourceType: input.sourceType,
        amount: input.amount,
        referenceText: input.referenceText,
        collectedAt: input.collectedAt,
        state: input.state,
        recordedById: input.recordedById,
        verifiedById: input.verifiedById ?? null,
      },
    });
  }

  return prisma.incomeRecord.create({
    data: input,
  });
}

async function ensureBudgetVersion(input: {
  eventId: string;
  version: number;
  title: string;
  state: BudgetState;
  isActive: boolean;
  createdById: string;
  items: DemoBudgetItemInput[];
}) {
  return prisma.budget.upsert({
    where: {
      eventId_version: {
        eventId: input.eventId,
        version: input.version,
      },
    },
    update: {
      title: input.title,
      state: input.state,
      isActive: input.isActive,
      totalAmount: moneyTotal(input.items),
      createdById: input.createdById,
      items: {
        deleteMany: {},
        create: input.items,
      },
    },
    create: {
      eventId: input.eventId,
      version: input.version,
      title: input.title,
      state: input.state,
      isActive: input.isActive,
      totalAmount: moneyTotal(input.items),
      createdById: input.createdById,
      items: {
        create: input.items,
      },
    },
  });
}

async function ensureBudgetRequest(input: {
  eventId: string;
  requestedById: string;
  amount: string;
  purpose: string;
  justification: string;
  state: RequestState;
}) {
  const existingRequest = await prisma.budgetRequest.findFirst({
    where: {
      eventId: input.eventId,
      purpose: input.purpose,
    },
  });

  if (existingRequest) {
    return prisma.budgetRequest.update({
      where: { id: existingRequest.id },
      data: {
        requestedById: input.requestedById,
        amount: input.amount,
        justification: input.justification,
        state: input.state,
      },
    });
  }

  return prisma.budgetRequest.create({
    data: input,
  });
}

async function ensureExpenseRequest(input: {
  eventId: string;
  requestedById: string;
  amount: string;
  category: string;
  purpose: string;
  justification: string;
  state: RequestState;
}) {
  const existingRequest = await prisma.expenseRequest.findFirst({
    where: {
      eventId: input.eventId,
      purpose: input.purpose,
    },
  });

  if (existingRequest) {
    return prisma.expenseRequest.update({
      where: { id: existingRequest.id },
      data: {
        requestedById: input.requestedById,
        amount: input.amount,
        category: input.category,
        justification: input.justification,
        state: input.state,
      },
    });
  }

  return prisma.expenseRequest.create({
    data: input,
  });
}

async function ensureExpenseRecord(input: {
  eventId: string;
  expenseRequestId: string;
  recordedById: string;
  amount: string;
  category: string;
  description: string;
  state: ExpenseRecordState;
  paidAt: Date;
}) {
  const existingRecord = await prisma.expenseRecord.findFirst({
    where: {
      eventId: input.eventId,
      description: input.description,
    },
  });

  if (existingRecord) {
    return prisma.expenseRecord.update({
      where: { id: existingRecord.id },
      data: {
        expenseRequestId: input.expenseRequestId,
        recordedById: input.recordedById,
        amount: input.amount,
        category: input.category,
        state: input.state,
        paidAt: input.paidAt,
      },
    });
  }

  return prisma.expenseRecord.create({
    data: input,
  });
}

async function ensureApprovalDecision(input: {
  entityType: ApprovalEntityType;
  actorId: string;
  decision: ApprovalDecisionType;
  comment: string;
  budgetRequestId?: string;
  expenseRequestId?: string;
}) {
  const existingDecision = await prisma.approvalDecision.findFirst({
    where: {
      actorId: input.actorId,
      decision: input.decision,
      budgetRequestId: input.budgetRequestId,
      expenseRequestId: input.expenseRequestId,
    },
  });

  if (existingDecision) {
    return prisma.approvalDecision.update({
      where: { id: existingDecision.id },
      data: {
        entityType: input.entityType,
        comment: input.comment,
      },
    });
  }

  return prisma.approvalDecision.create({
    data: input,
  });
}

async function ensureDerivedClosureArtifacts(
  closedEvent: { id: string; slug: string },
  financeActor: AuthenticatedUser,
  approverActor: AuthenticatedUser,
) {
  const existingSummary = await publicRepository.findPublishedSummaryByEventLookup(closedEvent.slug);

  if (existingSummary) {
    return {
      reportId: existingSummary.reconciliation.reportId,
      summaryId: existingSummary.id,
      summaryStatus: existingSummary.status,
    };
  }

  let report = await reconciliationRepository.findLatestReportForEvent(closedEvent.id);

  if (!report) {
    const generatedReport = await reconciliationService.generateReport(financeActor, {
      eventId: closedEvent.id,
    });

    report = await reconciliationRepository.findReportById(generatedReport.id);
  }

  if (!report) {
    throw new Error("Unable to create or load the demo reconciliation report.");
  }

  if (report.status === "DRAFT") {
    const reviewedReport = await reconciliationService.reviewReport(financeActor, report.id);
    report = await reconciliationRepository.findReportById(reviewedReport.id);
  }

  if (!report) {
    throw new Error("Unable to load the reviewed demo reconciliation report.");
  }

  if (report.status === "REVIEWED") {
    const finalizedReport = await reconciliationService.finalizeReport(approverActor, report.id);
    report = await reconciliationRepository.findReportById(finalizedReport.id);
  }

  if (!report || report.status !== "FINALIZED") {
    throw new Error("Demo reconciliation report is not finalized.");
  }

  const summary = await publicService.publishFinancialSummary(approverActor, report.id);

  return {
    reportId: report.id,
    summaryId: summary.id,
    summaryStatus: summary.status,
  };
}

async function main() {
  await ensureRoleCatalog();

  const demoEventManager = await ensureUser({
    fullName: "Demo Event Manager",
    email: "demo.event.manager@example.com",
    roles: [RoleCode.EVENT_MANAGEMENT_USER],
  });
  const demoFinanceController = await ensureUser({
    fullName: "Demo Finance Controller",
    email: "demo.finance@example.com",
    roles: [RoleCode.FINANCIAL_CONTROLLER],
  });
  const demoApprover = await ensureUser({
    fullName: "Demo Organizational Approver",
    email: "demo.approver@example.com",
    roles: [RoleCode.ORGANIZATIONAL_APPROVER],
  });
  const demoActiveStudent = await ensureUser({
    fullName: "Demo Active Student",
    email: "demo.active.student@example.com",
    roles: [RoleCode.GENERAL_STUDENT],
  });
  const demoVerifiedStudent = await ensureUser({
    fullName: "Demo Verified Student",
    email: "demo.verified.student@example.com",
    roles: [RoleCode.GENERAL_STUDENT],
  });
  const demoVerifiedStudentTwo = await ensureUser({
    fullName: "Demo Verified Student Two",
    email: "demo.verified.student.two@example.com",
    roles: [RoleCode.GENERAL_STUDENT],
  });

  const financeActor = buildAuthUser(demoFinanceController, [RoleCode.FINANCIAL_CONTROLLER]);
  const approverActor = buildAuthUser(demoApprover, [RoleCode.ORGANIZATIONAL_APPROVER]);

  const activeEvent = await ensureEvent({
    title: "Demo Open Finance Workshop 2026",
    slug: demoActiveEventSlug,
    description:
      "Active demo event for runtime verification of public listings, registrations, and payment verification queue behavior.",
    status: EventStatus.PUBLISHED,
    registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-05-31T23:59:59.000Z"),
    startsAt: new Date("2026-06-15T09:00:00.000Z"),
    endsAt: new Date("2026-06-15T16:00:00.000Z"),
    capacity: 200,
    createdById: demoEventManager.id,
  });

  const closedEvent = await ensureEvent({
    title: "Demo CSE Annual Tech Symposium 2026",
    slug: demoClosedEventSlug,
    description:
      "Closed demo event with verified income, settled expense, finalized reconciliation, and a published public summary.",
    status: EventStatus.CLOSED,
    registrationOpensAt: new Date("2026-01-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-01-20T23:59:59.000Z"),
    startsAt: new Date("2026-01-25T09:00:00.000Z"),
    endsAt: new Date("2026-01-25T18:00:00.000Z"),
    capacity: 300,
    createdById: demoEventManager.id,
  });

  const activeRegistration = await ensureRegistration({
    eventId: activeEvent.id,
    participantId: demoActiveStudent.id,
    participantName: demoActiveStudent.fullName,
    studentId: "DEMO-ACT-001",
    email: demoActiveStudent.email,
    phone: "8801000000101",
    registrationCode: "DEMO-ACT-REG-001",
    paymentState: "PENDING_VERIFICATION",
  });
  const closedRegistrationOne = await ensureRegistration({
    eventId: closedEvent.id,
    participantId: demoVerifiedStudent.id,
    participantName: demoVerifiedStudent.fullName,
    studentId: "DEMO-CLS-001",
    email: demoVerifiedStudent.email,
    phone: "8801000000201",
    registrationCode: "DEMO-CLS-REG-001",
    paymentState: "VERIFIED",
  });
  const closedRegistrationTwo = await ensureRegistration({
    eventId: closedEvent.id,
    participantId: demoVerifiedStudentTwo.id,
    participantName: demoVerifiedStudentTwo.fullName,
    studentId: "DEMO-CLS-002",
    email: demoVerifiedStudentTwo.email,
    phone: "8801000000202",
    registrationCode: "DEMO-CLS-REG-002",
    paymentState: "VERIFIED",
  });

  const activeProof = await ensurePaymentProof({
    registrationId: activeRegistration.id,
    externalChannel: "bKash",
    transactionReference: "DEMO-ACT-TXN-001",
    referenceText: "Pending demo payment proof waiting for finance verification.",
    amount: "500.00",
    state: PaymentProofState.PENDING_VERIFICATION,
  });
  const closedProofOne = await ensurePaymentProof({
    registrationId: closedRegistrationOne.id,
    externalChannel: "Nagad",
    transactionReference: "DEMO-CLS-TXN-001",
    referenceText: "Verified symposium registration payment proof for participant one.",
    amount: "600.00",
    state: PaymentProofState.VERIFIED,
    reviewedAt: new Date("2026-01-18T10:00:00.000Z"),
    reviewerRemark: "Verified against external transfer reference.",
    reviewedById: demoFinanceController.id,
  });
  const closedProofTwo = await ensurePaymentProof({
    registrationId: closedRegistrationTwo.id,
    externalChannel: "bKash",
    transactionReference: "DEMO-CLS-TXN-002",
    referenceText: "Verified symposium registration payment proof for participant two.",
    amount: "650.00",
    state: PaymentProofState.VERIFIED,
    reviewedAt: new Date("2026-01-18T10:05:00.000Z"),
    reviewerRemark: "Verified against external transfer reference.",
    reviewedById: demoFinanceController.id,
  });

  await ensureLinkedDemoDocument({
    category: DocumentCategory.PAYMENT_PROOF,
    destinationDir: documentDirectories.PAYMENT_PROOF,
    relationField: "paymentProofId",
    relationId: activeProof.id,
    originalName: "demo-active-payment-proof.pdf",
    uploadedById: demoActiveStudent.id,
    bodyLabel: "active payment proof",
  });
  await ensureLinkedDemoDocument({
    category: DocumentCategory.PAYMENT_PROOF,
    destinationDir: documentDirectories.PAYMENT_PROOF,
    relationField: "paymentProofId",
    relationId: closedProofOne.id,
    originalName: "demo-closed-payment-proof-1.pdf",
    uploadedById: demoVerifiedStudent.id,
    bodyLabel: "closed event payment proof one",
  });
  await ensureLinkedDemoDocument({
    category: DocumentCategory.PAYMENT_PROOF,
    destinationDir: documentDirectories.PAYMENT_PROOF,
    relationField: "paymentProofId",
    relationId: closedProofTwo.id,
    originalName: "demo-closed-payment-proof-2.pdf",
    uploadedById: demoVerifiedStudentTwo.id,
    bodyLabel: "closed event payment proof two",
  });

  const activeIncome = await ensureIncomeRecord({
    eventId: activeEvent.id,
    sourceType: IncomeSourceType.UNIVERSITY_SUPPORT,
    sourceLabel: "Demo Department Contribution",
    amount: "800.00",
    referenceText: "Department support note kept for finance review.",
    collectedAt: new Date("2026-04-01T10:00:00.000Z"),
    state: IncomeState.RECORDED,
    recordedById: demoFinanceController.id,
  });
  const closedIncome = await ensureIncomeRecord({
    eventId: closedEvent.id,
    sourceType: IncomeSourceType.SPONSOR,
    sourceLabel: "Tech Partners Ltd. Sponsorship",
    amount: "3000.00",
    referenceText: "Signed sponsor commitment for the symposium.",
    collectedAt: new Date("2026-01-20T11:00:00.000Z"),
    state: IncomeState.VERIFIED,
    recordedById: demoFinanceController.id,
    verifiedById: demoFinanceController.id,
  });

  await ensureLinkedDemoDocument({
    category: DocumentCategory.SUPPORTING_DOCUMENT,
    destinationDir: documentDirectories.SUPPORTING_DOCUMENT,
    relationField: "incomeRecordId",
    relationId: closedIncome.id,
    originalName: "demo-symposium-sponsor-letter.pdf",
    uploadedById: demoFinanceController.id,
    bodyLabel: "verified sponsor income evidence",
  });

  await ensureBudgetVersion({
    eventId: closedEvent.id,
    version: 1,
    title: "Initial Symposium Operating Budget",
    state: BudgetState.REVISED,
    isActive: false,
    createdById: demoEventManager.id,
    items: [
      { category: "Venue", label: "Hall reservation", amount: "1200.00" },
      { category: "Catering", label: "Tea and snacks", amount: "900.00" },
      { category: "Materials", label: "Print materials", amount: "700.00" },
      { category: "Media", label: "Photography", amount: "500.00" },
    ],
  });
  const activeBudget = await ensureBudgetVersion({
    eventId: closedEvent.id,
    version: 2,
    title: "Final Approved Symposium Budget",
    state: BudgetState.APPROVED,
    isActive: true,
    createdById: demoEventManager.id,
    items: [
      { category: "Venue", label: "Hall reservation", amount: "1200.00" },
      { category: "Catering", label: "Tea and snacks", amount: "1100.00" },
      { category: "Materials", label: "Print materials", amount: "700.00" },
      { category: "Logistics", label: "Guest and volunteer support", amount: "800.00" },
    ],
  });

  const pendingBudgetRequest = await ensureBudgetRequest({
    eventId: activeEvent.id,
    requestedById: demoEventManager.id,
    amount: "1200.00",
    purpose: "Demo pending banner and volunteer kit request",
    justification: "Needed before the open workshop begins.",
    state: RequestState.SUBMITTED,
  });
  const approvedBudgetRequest = await ensureBudgetRequest({
    eventId: closedEvent.id,
    requestedById: demoEventManager.id,
    amount: "1500.00",
    purpose: "Demo approved logistics reserve request",
    justification: "Reserve for closing logistics and certificates.",
    state: RequestState.APPROVED,
  });
  const approvedExpenseRequest = await ensureExpenseRequest({
    eventId: closedEvent.id,
    requestedById: demoEventManager.id,
    amount: "1800.00",
    category: "Operations",
    purpose: "Demo approved closing operations expense",
    justification: "Stage, certificates, and volunteer support costs.",
    state: RequestState.APPROVED,
  });

  await ensureLinkedDemoDocument({
    category: DocumentCategory.SUPPORTING_DOCUMENT,
    destinationDir: documentDirectories.SUPPORTING_DOCUMENT,
    relationField: "budgetRequestId",
    relationId: pendingBudgetRequest.id,
    originalName: "demo-open-budget-request.pdf",
    uploadedById: demoEventManager.id,
    bodyLabel: "pending open-event budget request",
  });
  await ensureLinkedDemoDocument({
    category: DocumentCategory.SUPPORTING_DOCUMENT,
    destinationDir: documentDirectories.SUPPORTING_DOCUMENT,
    relationField: "budgetRequestId",
    relationId: approvedBudgetRequest.id,
    originalName: "demo-closed-budget-request.pdf",
    uploadedById: demoEventManager.id,
    bodyLabel: "approved closed-event budget request",
  });
  await ensureLinkedDemoDocument({
    category: DocumentCategory.SUPPORTING_DOCUMENT,
    destinationDir: documentDirectories.SUPPORTING_DOCUMENT,
    relationField: "expenseRequestId",
    relationId: approvedExpenseRequest.id,
    originalName: "demo-closed-expense-request.pdf",
    uploadedById: demoEventManager.id,
    bodyLabel: "approved closed-event expense request",
  });

  await ensureApprovalDecision({
    entityType: ApprovalEntityType.BUDGET_REQUEST,
    actorId: demoApprover.id,
    decision: ApprovalDecisionType.APPROVED,
    comment: "Approved for final symposium logistics reserve.",
    budgetRequestId: approvedBudgetRequest.id,
  });
  await ensureApprovalDecision({
    entityType: ApprovalEntityType.EXPENSE_REQUEST,
    actorId: demoApprover.id,
    decision: ApprovalDecisionType.APPROVED,
    comment: "Approved for the final symposium operational expense.",
    expenseRequestId: approvedExpenseRequest.id,
  });

  const settledExpenseRecord = await ensureExpenseRecord({
    eventId: closedEvent.id,
    expenseRequestId: approvedExpenseRequest.id,
    recordedById: demoFinanceController.id,
    amount: "1800.00",
    category: "Operations",
    description: "Demo settled closing operations expense",
    state: ExpenseRecordState.SETTLED,
    paidAt: new Date("2026-01-26T13:00:00.000Z"),
  });

  await ensureLinkedDemoDocument({
    category: DocumentCategory.SUPPORTING_DOCUMENT,
    destinationDir: documentDirectories.SUPPORTING_DOCUMENT,
    relationField: "expenseRecordId",
    relationId: settledExpenseRecord.id,
    originalName: "demo-closed-expense-settlement.pdf",
    uploadedById: demoFinanceController.id,
    bodyLabel: "settled expense record evidence",
  });

  const derivedArtifacts = await ensureDerivedClosureArtifacts(
    closedEvent,
    financeActor,
    approverActor,
  );

  console.log("Backend runtime demo data is ready.");
  console.log(`Active event: ${activeEvent.slug}`);
  console.log(`Closed event: ${closedEvent.slug}`);
  console.log(`Pending verification proof: ${activeProof.id}`);
  console.log(`Recorded manual income: ${activeIncome.id}`);
  console.log(`Verified manual income: ${closedIncome.id}`);
  console.log(`Active budget version: ${activeBudget.version}`);
  console.log(`Pending approval request: ${pendingBudgetRequest.id}`);
  console.log(`Approved expense request: ${approvedExpenseRequest.id}`);
  console.log(`Settled expense record: ${settledExpenseRecord.id}`);
  console.log(`Reconciliation report: ${derivedArtifacts.reportId}`);
  console.log(`Published summary: ${derivedArtifacts.summaryId}`);
}

void main()
  .catch((error) => {
    console.error("Backend runtime demo seed failed.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
