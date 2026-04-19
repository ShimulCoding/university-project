import {
  EventStatus,
  ExpenseRecordState,
  IncomeState,
  Prisma,
  ReconciliationState,
} from "@prisma/client";

import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import {
  hasReconciliationFinalizeAccess,
  hasReconciliationManagementAccess,
  hasReconciliationReadAccess,
} from "../../../utils/role-checks";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { eventsRepository } from "../../events/repositories/events.repository";
import {
  getReconciliationPayload,
  mapReconciliationReport,
  type ReconciliationReportWithContext,
} from "../reconciliation.mappers";
import { reconciliationRepository } from "../repositories/reconciliation.repository";
import type {
  GenerateReconciliationInput,
  ReconciliationBreakdown,
  ReconciliationFilters,
  ReconciliationPayload,
  ReconciliationWarning,
} from "../types/reconciliation.types";

function assertReconciliationReadPermissions(viewer: AuthenticatedUser) {
  if (!hasReconciliationReadAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to view reconciliation reports.");
  }
}

function assertReconciliationManagementPermissions(viewer: AuthenticatedUser) {
  if (!hasReconciliationManagementAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to generate or review reconciliation reports.");
  }
}

function assertReconciliationFinalizePermissions(viewer: AuthenticatedUser) {
  if (!hasReconciliationFinalizeAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to finalize reconciliation reports.");
  }
}

const reconcilableEventStatuses: EventStatus[] = [EventStatus.COMPLETED, EventStatus.CLOSED];

function assertEventCanBeReconciled(status: EventStatus) {
  if (!reconcilableEventStatuses.includes(status)) {
    throw new AppError(
      409,
      "Reconciliation reports can only be generated after the event is completed or closed.",
    );
  }
}

function sumDecimals(values: Array<Prisma.Decimal | null>): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (sum, value) => (value ? sum.plus(value) : sum),
    new Prisma.Decimal(0),
  );
}

function decimalToMoney(value: Prisma.Decimal) {
  return value.toFixed(2);
}

async function assertLatestReport(report: ReconciliationReportWithContext) {
  const latestReport = await reconciliationRepository.findLatestReportForEvent(report.eventId);

  if (!latestReport || latestReport.id !== report.id) {
    throw new AppError(409, "Only the latest reconciliation report for an event can be advanced.");
  }
}

function assertReportIsFresh(report: ReconciliationReportWithContext) {
  if (report.isStale) {
    throw new AppError(
      409,
      "This reconciliation report is stale because event financial records changed. Generate a new reconciliation report before advancing it.",
    );
  }
}

async function buildReconciliationPayload(eventId: string): Promise<{
  totalIncome: Prisma.Decimal;
  totalExpense: Prisma.Decimal;
  closingBalance: Prisma.Decimal;
  payload: ReconciliationPayload;
}> {
  const [
    verifiedPaymentProofs,
    verifiedRegistrationCount,
    manualIncomeRecords,
    expenseRecords,
    approvedExpenseRequests,
  ] = await Promise.all([
    reconciliationRepository.listVerifiedPaymentProofs(eventId),
    reconciliationRepository.countVerifiedRegistrations(eventId),
    reconciliationRepository.listManualIncomeRecords(eventId),
    reconciliationRepository.listExpenseRecords(eventId),
    reconciliationRepository.listApprovedExpenseRequests(eventId),
  ]);

  const verifiedRegistrationIncome = sumDecimals(
    verifiedPaymentProofs.map((proof) => proof.amount),
  );
  const verifiedManualIncomeRecords = manualIncomeRecords.filter(
    (record) => record.state === IncomeState.VERIFIED,
  );
  const manualIncome = sumDecimals(verifiedManualIncomeRecords.map((record) => record.amount));
  const settledExpenseRecords = expenseRecords.filter(
    (record) => record.state === ExpenseRecordState.SETTLED,
  );
  const totalExpense = sumDecimals(settledExpenseRecords.map((record) => record.amount));
  const totalIncome = verifiedRegistrationIncome.plus(manualIncome);
  const closingBalance = totalIncome.minus(totalExpense);
  const missingProofAmountCount = verifiedPaymentProofs.filter((proof) => !proof.amount).length;
  const unverifiedManualIncomeCount = manualIncomeRecords.filter(
    (record) => record.state !== IncomeState.VERIFIED,
  ).length;
  const pendingExpenseRecordCount = expenseRecords.filter(
    (record) => record.state === ExpenseRecordState.RECORDED,
  ).length;
  const approvedExpenseRequestsWithoutSettledRecord = approvedExpenseRequests.filter(
    (request) =>
      !request.expenseRecords.some((record) => record.state === ExpenseRecordState.SETTLED),
  ).length;
  const warnings: ReconciliationWarning[] = [];

  if (missingProofAmountCount > 0) {
    warnings.push({
      code: "VERIFIED_PAYMENT_PROOF_MISSING_AMOUNT",
      severity: "warning",
      message: "Some verified payment proofs do not have an amount and were excluded from totals.",
      count: missingProofAmountCount,
    });
  }

  if (verifiedRegistrationCount > verifiedPaymentProofs.length) {
    warnings.push({
      code: "VERIFIED_REGISTRATION_WITHOUT_VERIFIED_PROOF",
      severity: "warning",
      message: "Some verified registrations do not have a matching verified payment proof.",
      count: verifiedRegistrationCount - verifiedPaymentProofs.length,
    });
  }

  if (unverifiedManualIncomeCount > 0) {
    warnings.push({
      code: "MANUAL_INCOME_NOT_VERIFIED",
      severity: "warning",
      message: "Some manual income records are not yet verified and were excluded from income totals.",
      count: unverifiedManualIncomeCount,
    });
  }

  if (pendingExpenseRecordCount > 0) {
    warnings.push({
      code: "EXPENSE_RECORD_NOT_SETTLED",
      severity: "info",
      message: "Some recorded expenses are not settled and were excluded from expense totals.",
      count: pendingExpenseRecordCount,
    });
  }

  if (approvedExpenseRequestsWithoutSettledRecord > 0) {
    warnings.push({
      code: "APPROVED_EXPENSE_REQUEST_WITHOUT_SETTLEMENT",
      severity: "warning",
      message: "Some approved expense requests do not yet have a settled expense record.",
      count: approvedExpenseRequestsWithoutSettledRecord,
    });
  }

  const breakdown: ReconciliationBreakdown = {
    verifiedRegistrationIncome: decimalToMoney(verifiedRegistrationIncome),
    manualIncome: decimalToMoney(manualIncome),
    settledExpense: decimalToMoney(totalExpense),
    verifiedPaymentProofCount: verifiedPaymentProofs.length,
    verifiedPaymentProofsMissingAmount: missingProofAmountCount,
    manualIncomeRecordCount: manualIncomeRecords.length,
    unverifiedManualIncomeRecordCount: unverifiedManualIncomeCount,
    settledExpenseRecordCount: settledExpenseRecords.length,
    pendingExpenseRecordCount,
    approvedExpenseRequestsWithoutSettledRecord,
  };

  return {
    totalIncome,
    totalExpense,
    closingBalance,
    payload: {
      warnings,
      breakdown,
    },
  };
}

export const reconciliationService = {
  async listReports(viewer: AuthenticatedUser, filters: ReconciliationFilters) {
    assertReconciliationReadPermissions(viewer);

    const paginationOptions = getPaginationOptions(filters);
    const [reports, totalItems] = await Promise.all([
      reconciliationRepository.listReports(filters, paginationOptions),
      reconciliationRepository.countReports(filters),
    ]);

    return {
      reports: reports.map(mapReconciliationReport),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getReportById(viewer: AuthenticatedUser, reportId: string) {
    assertReconciliationReadPermissions(viewer);

    const report = await reconciliationRepository.findReportById(reportId);

    if (!report) {
      throw new AppError(404, "Reconciliation report not found.");
    }

    return mapReconciliationReport(report);
  },

  async generateReport(
    actor: AuthenticatedUser,
    input: GenerateReconciliationInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertReconciliationManagementPermissions(actor);

    const event = await eventsRepository.findById(input.eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    assertEventCanBeReconciled(event.status);

    const summary = await buildReconciliationPayload(input.eventId);
    const report = await reconciliationRepository.createReport({
      eventId: input.eventId,
      generatedById: actor.id,
      totalIncome: decimalToMoney(summary.totalIncome),
      totalExpense: decimalToMoney(summary.totalExpense),
      closingBalance: decimalToMoney(summary.closingBalance),
      payload: summary.payload,
    });

    await auditService.record({
      actorId: actor.id,
      action: "reconciliation.generate",
      entityType: "ReconciliationReport",
      entityId: report.id,
      summary: `Generated reconciliation draft for ${report.event.title}`,
      context: {
        eventId: report.event.id,
        status: report.status,
        warningCount: summary.payload.warnings.length,
      },
      ...auditMetadata,
    });

    return mapReconciliationReport(report);
  },

  async reviewReport(actor: AuthenticatedUser, reportId: string, auditMetadata?: AuditMetadata) {
    assertReconciliationManagementPermissions(actor);

    const report = await reconciliationRepository.findReportById(reportId);

    if (!report) {
      throw new AppError(404, "Reconciliation report not found.");
    }

    if (report.status !== ReconciliationState.DRAFT) {
      throw new AppError(409, "Only draft reconciliation reports can be marked as reviewed.");
    }

    assertReportIsFresh(report);
    await assertLatestReport(report);

    const reviewedReport = await reconciliationRepository.updateReportStatus(reportId, {
      status: ReconciliationState.REVIEWED,
      reviewedById: actor.id,
    });

    await auditService.record({
      actorId: actor.id,
      action: "reconciliation.review",
      entityType: "ReconciliationReport",
      entityId: reviewedReport.id,
      summary: `Reviewed reconciliation report for ${reviewedReport.event.title}`,
      context: {
        eventId: reviewedReport.event.id,
        previousStatus: report.status,
        nextStatus: reviewedReport.status,
      },
      ...auditMetadata,
    });

    return mapReconciliationReport(reviewedReport);
  },

  async finalizeReport(actor: AuthenticatedUser, reportId: string, auditMetadata?: AuditMetadata) {
    assertReconciliationFinalizePermissions(actor);

    const report = await reconciliationRepository.findReportById(reportId);

    if (!report) {
      throw new AppError(404, "Reconciliation report not found.");
    }

    if (report.status !== ReconciliationState.REVIEWED) {
      throw new AppError(409, "Only reviewed reconciliation reports can be finalized.");
    }

    assertReportIsFresh(report);
    await assertLatestReport(report);

    const finalizedReport = await reconciliationRepository.updateReportStatus(reportId, {
      status: ReconciliationState.FINALIZED,
      reviewedById: report.reviewedBy ? undefined : actor.id,
      finalizedAt: new Date(),
    });

    await auditService.record({
      actorId: actor.id,
      action: "reconciliation.finalize",
      entityType: "ReconciliationReport",
      entityId: finalizedReport.id,
      summary: `Finalized reconciliation report for ${finalizedReport.event.title}`,
      context: {
        eventId: finalizedReport.event.id,
        previousStatus: report.status,
        nextStatus: finalizedReport.status,
        warningCount: getReconciliationPayload(finalizedReport).warnings.length,
      },
      ...auditMetadata,
    });

    return mapReconciliationReport(finalizedReport);
  },
};
