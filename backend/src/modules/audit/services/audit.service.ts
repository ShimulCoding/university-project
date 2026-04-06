import { auditRepository } from "../repositories/audit.repository";
import type { AuditFilters, CreateAuditLogInput } from "../types/audit.types";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { hasAuditReadAccess } from "../../../utils/role-checks";

function assertAuditReadPermissions(viewer: AuthenticatedUser) {
  if (!hasAuditReadAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to view audit logs.");
  }
}

function mapAuditLog(log: Awaited<ReturnType<typeof auditRepository.findById>>) {
  if (!log) {
    return null;
  }

  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    summary: log.summary,
    context: log.context,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    route: log.route,
    method: log.method,
    createdAt: log.createdAt,
    actor: log.actor ?? null,
  };
}

export const auditService = {
  record(input: CreateAuditLogInput) {
    return auditRepository.create(input);
  },

  async listAuditLogs(viewer: AuthenticatedUser, filters: AuditFilters) {
    assertAuditReadPermissions(viewer);

    const logs = await auditRepository.list(filters);

    return logs.map((log) => mapAuditLog(log)!);
  },

  async getAuditLogById(viewer: AuthenticatedUser, auditLogId: string) {
    assertAuditReadPermissions(viewer);

    const log = await auditRepository.findById(auditLogId);

    if (!log) {
      throw new AppError(404, "Audit log not found.");
    }

    return mapAuditLog(log);
  },
};
