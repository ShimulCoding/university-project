import {
  ExpenseRecordState,
  IncomeState,
  PaymentProofState,
  Prisma,
  ReconciliationState,
  RegistrationPaymentState,
  RequestState,
} from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { reconciliationReportDetailInclude } from "../reconciliation.mappers";
import type { ReconciliationFilters, ReconciliationPayload } from "../types/reconciliation.types";

type CreateReconciliationReportData = {
  eventId: string;
  generatedById: string;
  totalIncome: string;
  totalExpense: string;
  closingBalance: string;
  payload: ReconciliationPayload;
};

type UpdateReconciliationReportStatusData = {
  status: ReconciliationState;
  reviewedById?: string | undefined;
  finalizedAt?: Date | null | undefined;
};

function buildReportWhere(filters: ReconciliationFilters): Prisma.ReconciliationReportWhereInput {
  const where: Prisma.ReconciliationReportWhereInput = {};

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

export const reconciliationRepository = {
  listReports(filters: ReconciliationFilters, db: DbClient = prisma) {
    return db.reconciliationReport.findMany({
      where: buildReportWhere(filters),
      include: reconciliationReportDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  findReportById(reportId: string, db: DbClient = prisma) {
    return db.reconciliationReport.findUnique({
      where: { id: reportId },
      include: reconciliationReportDetailInclude,
    });
  },

  findLatestReportForEvent(eventId: string, db: DbClient = prisma) {
    return db.reconciliationReport.findFirst({
      where: { eventId },
      include: reconciliationReportDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  createReport(data: CreateReconciliationReportData, db: DbClient = prisma) {
    return db.reconciliationReport.create({
      data: {
        eventId: data.eventId,
        generatedById: data.generatedById,
        totalIncome: data.totalIncome,
        totalExpense: data.totalExpense,
        closingBalance: data.closingBalance,
        warnings: data.payload as unknown as Prisma.InputJsonValue,
      },
      include: reconciliationReportDetailInclude,
    });
  },

  updateReportStatus(
    reportId: string,
    data: UpdateReconciliationReportStatusData,
    db: DbClient = prisma,
  ) {
    return db.reconciliationReport.update({
      where: { id: reportId },
      data: {
        status: data.status,
        ...(data.reviewedById ? { reviewedById: data.reviewedById } : {}),
        ...(data.finalizedAt !== undefined ? { finalizedAt: data.finalizedAt } : {}),
      },
      include: reconciliationReportDetailInclude,
    });
  },

  listVerifiedPaymentProofs(eventId: string, db: DbClient = prisma) {
    return db.paymentProof.findMany({
      where: {
        state: PaymentProofState.VERIFIED,
        registration: {
          eventId,
        },
      },
      select: {
        id: true,
        amount: true,
        registrationId: true,
      },
    });
  },

  countVerifiedRegistrations(eventId: string, db: DbClient = prisma) {
    return db.registration.count({
      where: {
        eventId,
        paymentState: RegistrationPaymentState.VERIFIED,
      },
    });
  },

  listManualIncomeRecords(eventId: string, db: DbClient = prisma) {
    return db.incomeRecord.findMany({
      where: {
        eventId,
        state: {
          not: IncomeState.REJECTED,
        },
      },
      select: {
        id: true,
        sourceType: true,
        sourceLabel: true,
        amount: true,
        state: true,
      },
    });
  },

  listExpenseRecords(eventId: string, db: DbClient = prisma) {
    return db.expenseRecord.findMany({
      where: {
        eventId,
        state: {
          not: ExpenseRecordState.VOIDED,
        },
      },
      select: {
        id: true,
        amount: true,
        state: true,
        expenseRequestId: true,
      },
    });
  },

  listApprovedExpenseRequests(eventId: string, db: DbClient = prisma) {
    return db.expenseRequest.findMany({
      where: {
        eventId,
        state: RequestState.APPROVED,
      },
      select: {
        id: true,
        amount: true,
        expenseRecords: {
          select: {
            id: true,
            state: true,
          },
        },
      },
    });
  },
};
