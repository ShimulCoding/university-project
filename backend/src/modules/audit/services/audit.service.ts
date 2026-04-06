import { auditRepository } from "../repositories/audit.repository";
import type { AuditFilters, CreateAuditLogInput } from "../types/audit.types";

export const auditService = {
  record(input: CreateAuditLogInput) {
    return auditRepository.create(input);
  },

  async listAuditLogs(filters: AuditFilters) {
    const logs = await auditRepository.list(filters);

    return logs.map((log) => ({
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
    }));
  },
};
