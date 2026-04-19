import { Prisma, type DocumentCategory, type ExpenseRecordState, type RequestState } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { PaginationOptions } from "../../../utils/pagination";
import {
  budgetRequestDetailInclude,
  expenseRecordDetailInclude,
  expenseRequestDetailInclude,
} from "../requests.mappers";
import type {
  CreateBudgetRequestInput,
  CreateExpenseRecordInput,
  CreateExpenseRequestInput,
  ExpenseRecordFilters,
  RequestFilters,
  UpdateBudgetRequestInput,
  UpdateExpenseRequestInput,
} from "../types/requests.types";

type CreateSupportingDocumentData = {
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  storedName: string;
  relativePath: string;
  sizeBytes: bigint;
  uploadedById: string;
  budgetRequestId?: string | undefined;
  expenseRequestId?: string | undefined;
  expenseRecordId?: string | undefined;
};

type UpdateExpenseRecordStateData = {
  state: ExpenseRecordState;
  paidAt?: Date | null | undefined;
};

function buildRequestWhere(filters: RequestFilters): Prisma.BudgetRequestWhereInput {
  const where: Prisma.BudgetRequestWhereInput = {};

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  if (filters.state) {
    where.state = filters.state;
  }

  return where;
}

function buildExpenseRequestWhere(filters: RequestFilters): Prisma.ExpenseRequestWhereInput {
  const where: Prisma.ExpenseRequestWhereInput = {};

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  if (filters.state) {
    where.state = filters.state;
  }

  return where;
}

function buildExpenseRecordWhere(filters: ExpenseRecordFilters): Prisma.ExpenseRecordWhereInput {
  const where: Prisma.ExpenseRecordWhereInput = {};

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  if (filters.state) {
    where.state = filters.state;
  }

  if (filters.expenseRequestId) {
    where.expenseRequestId = filters.expenseRequestId;
  }

  return where;
}

function buildBudgetRequestUpdateData(
  input: UpdateBudgetRequestInput,
): Prisma.BudgetRequestUncheckedUpdateInput {
  return {
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.purpose !== undefined ? { purpose: input.purpose.trim() } : {}),
    ...(input.justification !== undefined ? { justification: input.justification } : {}),
  };
}

function buildExpenseRequestUpdateData(
  input: UpdateExpenseRequestInput,
): Prisma.ExpenseRequestUncheckedUpdateInput {
  return {
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.category !== undefined ? { category: input.category.trim() } : {}),
    ...(input.purpose !== undefined ? { purpose: input.purpose.trim() } : {}),
    ...(input.justification !== undefined ? { justification: input.justification } : {}),
  };
}

export const requestsRepository = {
  findBudgetRequestById(budgetRequestId: string, db: DbClient = prisma) {
    return db.budgetRequest.findUnique({
      where: { id: budgetRequestId },
      include: budgetRequestDetailInclude,
    });
  },

  listBudgetRequests(filters: RequestFilters, pagination?: PaginationOptions, db: DbClient = prisma) {
    return db.budgetRequest.findMany({
      where: buildRequestWhere(filters),
      include: budgetRequestDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countBudgetRequests(filters: RequestFilters, db: DbClient = prisma) {
    return db.budgetRequest.count({
      where: buildRequestWhere(filters),
    });
  },

  listBudgetRequestsByRequester(
    requestedById: string,
    filters: RequestFilters,
    pagination?: PaginationOptions,
    db: DbClient = prisma,
  ) {
    return db.budgetRequest.findMany({
      where: {
        ...buildRequestWhere(filters),
        requestedById,
      },
      include: budgetRequestDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countBudgetRequestsByRequester(
    requestedById: string,
    filters: RequestFilters,
    db: DbClient = prisma,
  ) {
    return db.budgetRequest.count({
      where: {
        ...buildRequestWhere(filters),
        requestedById,
      },
    });
  },

  createBudgetRequest(
    actorId: string,
    input: CreateBudgetRequestInput,
    state: RequestState,
    db: DbClient = prisma,
  ) {
    return db.budgetRequest.create({
      data: {
        eventId: input.eventId,
        requestedById: actorId,
        amount: input.amount,
        purpose: input.purpose.trim(),
        state,
        ...(input.justification ? { justification: input.justification } : {}),
      },
      include: budgetRequestDetailInclude,
    });
  },

  updateBudgetRequest(
    budgetRequestId: string,
    input: UpdateBudgetRequestInput,
    db: DbClient = prisma,
  ) {
    return db.budgetRequest.update({
      where: { id: budgetRequestId },
      data: buildBudgetRequestUpdateData(input),
      include: budgetRequestDetailInclude,
    });
  },

  updateBudgetRequestState(
    budgetRequestId: string,
    state: RequestState,
    db: DbClient = prisma,
  ) {
    return db.budgetRequest.update({
      where: { id: budgetRequestId },
      data: { state },
      include: budgetRequestDetailInclude,
    });
  },

  findExpenseRequestById(expenseRequestId: string, db: DbClient = prisma) {
    return db.expenseRequest.findUnique({
      where: { id: expenseRequestId },
      include: expenseRequestDetailInclude,
    });
  },

  listExpenseRequests(filters: RequestFilters, pagination?: PaginationOptions, db: DbClient = prisma) {
    return db.expenseRequest.findMany({
      where: buildExpenseRequestWhere(filters),
      include: expenseRequestDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countExpenseRequests(filters: RequestFilters, db: DbClient = prisma) {
    return db.expenseRequest.count({
      where: buildExpenseRequestWhere(filters),
    });
  },

  listExpenseRequestsByRequester(
    requestedById: string,
    filters: RequestFilters,
    pagination?: PaginationOptions,
    db: DbClient = prisma,
  ) {
    return db.expenseRequest.findMany({
      where: {
        ...buildExpenseRequestWhere(filters),
        requestedById,
      },
      include: expenseRequestDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countExpenseRequestsByRequester(
    requestedById: string,
    filters: RequestFilters,
    db: DbClient = prisma,
  ) {
    return db.expenseRequest.count({
      where: {
        ...buildExpenseRequestWhere(filters),
        requestedById,
      },
    });
  },

  createExpenseRequest(
    actorId: string,
    input: CreateExpenseRequestInput,
    state: RequestState,
    db: DbClient = prisma,
  ) {
    return db.expenseRequest.create({
      data: {
        eventId: input.eventId,
        requestedById: actorId,
        amount: input.amount,
        category: input.category.trim(),
        purpose: input.purpose.trim(),
        state,
        ...(input.justification ? { justification: input.justification } : {}),
      },
      include: expenseRequestDetailInclude,
    });
  },

  updateExpenseRequest(
    expenseRequestId: string,
    input: UpdateExpenseRequestInput,
    db: DbClient = prisma,
  ) {
    return db.expenseRequest.update({
      where: { id: expenseRequestId },
      data: buildExpenseRequestUpdateData(input),
      include: expenseRequestDetailInclude,
    });
  },

  updateExpenseRequestState(
    expenseRequestId: string,
    state: RequestState,
    db: DbClient = prisma,
  ) {
    return db.expenseRequest.update({
      where: { id: expenseRequestId },
      data: { state },
      include: expenseRequestDetailInclude,
    });
  },

  deleteSupportingDocumentsForExpenseRequest(expenseRequestId: string, db: DbClient = prisma) {
    return db.supportingDocument.deleteMany({
      where: { expenseRequestId },
    });
  },

  createSupportingDocument(data: CreateSupportingDocumentData, db: DbClient = prisma) {
    return db.supportingDocument.create({
      data: {
        category: data.category,
        originalName: data.originalName,
        mimeType: data.mimeType,
        storedName: data.storedName,
        relativePath: data.relativePath,
        sizeBytes: data.sizeBytes,
        uploadedById: data.uploadedById,
        ...(data.budgetRequestId ? { budgetRequestId: data.budgetRequestId } : {}),
        ...(data.expenseRequestId ? { expenseRequestId: data.expenseRequestId } : {}),
        ...(data.expenseRecordId ? { expenseRecordId: data.expenseRecordId } : {}),
      },
    });
  },

  createExpenseRecord(
    actorId: string,
    input: CreateExpenseRecordInput,
    state: ExpenseRecordState,
    db: DbClient = prisma,
  ) {
    return db.expenseRecord.create({
      data: {
        eventId: input.eventId,
        recordedById: actorId,
        amount: input.amount,
        category: input.category.trim(),
        description: input.description.trim(),
        state,
        ...(input.expenseRequestId ? { expenseRequestId: input.expenseRequestId } : {}),
        ...(input.paidAt ? { paidAt: input.paidAt } : {}),
      },
      include: expenseRecordDetailInclude,
    });
  },

  listExpenseRecords(
    filters: ExpenseRecordFilters,
    pagination?: PaginationOptions,
    db: DbClient = prisma,
  ) {
    return db.expenseRecord.findMany({
      where: buildExpenseRecordWhere(filters),
      include: expenseRecordDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countExpenseRecords(filters: ExpenseRecordFilters, db: DbClient = prisma) {
    return db.expenseRecord.count({
      where: buildExpenseRecordWhere(filters),
    });
  },

  findExpenseRecordById(expenseRecordId: string, db: DbClient = prisma) {
    return db.expenseRecord.findUnique({
      where: { id: expenseRecordId },
      include: expenseRecordDetailInclude,
    });
  },

  updateExpenseRecordState(
    expenseRecordId: string,
    input: UpdateExpenseRecordStateData,
    db: DbClient = prisma,
  ) {
    return db.expenseRecord.update({
      where: { id: expenseRecordId },
      data: {
        state: input.state,
        ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
      },
      include: expenseRecordDetailInclude,
    });
  },
};
