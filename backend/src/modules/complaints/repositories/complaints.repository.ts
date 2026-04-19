import { ComplaintState, Prisma, type DocumentCategory } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { PaginationOptions } from "../../../utils/pagination";
import { complaintDetailInclude } from "../complaints.mappers";
import type { ComplaintQueueFilters } from "../types/complaints.types";

type CreateComplaintData = {
  subject: string;
  description: string;
  submittedById: string;
  eventId?: string | undefined;
};

type CreateComplaintRoutingData = {
  complaintId: string;
  state: ComplaintState;
  fromRoleId?: string | undefined;
  toRoleId?: string | undefined;
  routedById?: string | undefined;
  note?: string | undefined;
};

type CreateSupportingDocumentData = {
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  storedName: string;
  relativePath: string;
  sizeBytes: bigint;
  uploadedById: string;
  complaintId: string;
};

const defaultReviewStates = [
  ComplaintState.SUBMITTED,
  ComplaintState.UNDER_REVIEW,
  ComplaintState.ROUTED,
  ComplaintState.ESCALATED,
] as const;

function buildQueueWhere(filters: ComplaintQueueFilters): Prisma.ComplaintWhereInput {
  const where: Prisma.ComplaintWhereInput = {
    state: filters.state
      ? filters.state
      : {
          in: [...defaultReviewStates],
        },
  };

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  const trimmedSearch = filters.search?.trim();

  if (trimmedSearch) {
    where.OR = [
      {
        subject: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
      {
        event: {
          title: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
      },
      {
        submittedBy: {
          fullName: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
      },
      {
        submittedBy: {
          email: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  return where;
}

function buildSubmitterWhere(
  submittedById: string,
  filters: ComplaintQueueFilters,
): Prisma.ComplaintWhereInput {
  const where: Prisma.ComplaintWhereInput = {
    submittedById,
  };

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  if (filters.state) {
    where.state = filters.state;
  }

  const trimmedSearch = filters.search?.trim();

  if (trimmedSearch) {
    where.OR = [
      {
        subject: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
      {
        event: {
          title: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  return where;
}

export const complaintsRepository = {
  findComplaintById(complaintId: string, db: DbClient = prisma) {
    return db.complaint.findUnique({
      where: { id: complaintId },
      include: complaintDetailInclude,
    });
  },

  listComplaintsBySubmitter(
    submittedById: string,
    filters: ComplaintQueueFilters,
    pagination?: PaginationOptions,
    db: DbClient = prisma,
  ) {
    return db.complaint.findMany({
      where: buildSubmitterWhere(submittedById, filters),
      include: complaintDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countComplaintsBySubmitter(
    submittedById: string,
    filters: ComplaintQueueFilters,
    db: DbClient = prisma,
  ) {
    return db.complaint.count({
      where: buildSubmitterWhere(submittedById, filters),
    });
  },

  listReviewQueue(
    filters: ComplaintQueueFilters,
    pagination?: PaginationOptions,
    db: DbClient = prisma,
  ) {
    return db.complaint.findMany({
      where: buildQueueWhere(filters),
      include: complaintDetailInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countReviewQueue(filters: ComplaintQueueFilters, db: DbClient = prisma) {
    return db.complaint.count({
      where: buildQueueWhere(filters),
    });
  },

  createComplaint(data: CreateComplaintData, db: DbClient = prisma) {
    return db.complaint.create({
      data: {
        subject: data.subject.trim(),
        description: data.description.trim(),
        submittedById: data.submittedById,
        ...(data.eventId ? { eventId: data.eventId } : {}),
      },
      include: complaintDetailInclude,
    });
  },

  updateComplaintState(
    complaintId: string,
    state: ComplaintState,
    db: DbClient = prisma,
  ) {
    return db.complaint.update({
      where: { id: complaintId },
      data: { state },
      include: complaintDetailInclude,
    });
  },

  createRoutingHistory(data: CreateComplaintRoutingData, db: DbClient = prisma) {
    return db.complaintRouting.create({
      data: {
        complaintId: data.complaintId,
        state: data.state,
        ...(data.fromRoleId ? { fromRoleId: data.fromRoleId } : {}),
        ...(data.toRoleId ? { toRoleId: data.toRoleId } : {}),
        ...(data.routedById ? { routedById: data.routedById } : {}),
        ...(data.note ? { note: data.note } : {}),
      },
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
        complaintId: data.complaintId,
      },
    });
  },
};
