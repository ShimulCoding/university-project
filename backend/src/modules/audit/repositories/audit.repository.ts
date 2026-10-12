import { Prisma, type AuditLog } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { PaginationOptions } from "../../../utils/pagination";
import type { AuditFilters, CreateAuditLogInput } from "../types/audit.types";
import { sanitizeAuditMetadata } from "../../../utils/audit-metadata";

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
  create(input: CreateAuditLogInput, db: DbClient = prisma): Promise<AuditLog> {
    const metadata = sanitizeAuditMetadata(input);
    const eventId = input.eventId ??
      (typeof input.context?.eventId === "string" ? input.context.eventId : undefined) ??
      (input.entityType === "Event" ? input.entityId : undefined);
    const createData: Prisma.AuditLogUncheckedCreateInput = {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      // Foreign keys enforce these references; nested connect adds avoidable reads.
      ...(eventId ? { eventId } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.context ? { context: input.context as Prisma.InputJsonValue } : {}),
      ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
      ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
      ...(metadata.route ? { route: metadata.route } : {}),
      ...(metadata.method ? { method: metadata.method } : {}),
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
