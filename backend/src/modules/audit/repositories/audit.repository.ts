import { Prisma } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { PaginationOptions } from "../../../utils/pagination";
import type { AuditFilters, CreateAuditLogInput } from "../types/audit.types";

function buildAuditWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.actorId) {
    where.actorId = filters.actorId;
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.entityId) {
    where.entityId = filters.entityId;
  }

  return where;
}

export const auditRepository = {
  create(input: CreateAuditLogInput, db: DbClient = prisma) {
    const createData: Prisma.AuditLogCreateInput = {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ...(input.actorId ? { actor: { connect: { id: input.actorId } } } : {}),
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.context ? { context: input.context as Prisma.InputJsonValue } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      ...(input.route ? { route: input.route } : {}),
      ...(input.method ? { method: input.method } : {}),
    };

    return db.auditLog.create({
      data: createData,
    });
  },

  list(filters: AuditFilters, pagination: PaginationOptions, db: DbClient = prisma) {
    return db.auditLog.findMany({
      where: buildAuditWhere(filters),
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: pagination.skip,
      take: pagination.take,
    });
  },

  count(filters: AuditFilters, db: DbClient = prisma) {
    return db.auditLog.count({
      where: buildAuditWhere(filters),
    });
  },

  findById(auditLogId: string, db: DbClient = prisma) {
    return db.auditLog.findUnique({
      where: { id: auditLogId },
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  },
};
