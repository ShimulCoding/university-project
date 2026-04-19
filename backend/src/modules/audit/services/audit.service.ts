import { auditRepository } from "../repositories/audit.repository";
import type { AuditFilters, CreateAuditLogInput } from "../types/audit.types";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
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

    const paginationOptions = getPaginationOptions({
      page: filters.page,
      pageSize: filters.pageSize ?? filters.limit,
    });
    const [logs, totalItems] = await Promise.all([
      auditRepository.list(filters, paginationOptions),
      auditRepository.count(filters),
    ]);

    return {
      logs: logs.map((log) => mapAuditLog(log)!),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
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
