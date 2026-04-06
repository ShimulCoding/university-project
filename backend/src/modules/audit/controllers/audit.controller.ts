import type { Request, Response } from "express";

import { auditService } from "../services/audit.service";
import type { AuditFilters } from "../types/audit.types";

export const auditController = {
  async listAuditLogs(request: Request, response: Response) {
    const filters: AuditFilters = {
      actorId: request.query.actorId as string | undefined,
      entityType: request.query.entityType as string | undefined,
      entityId: request.query.entityId as string | undefined,
      limit: Number(request.query.limit ?? 20),
    };
    const logs = await auditService.listAuditLogs(request.auth!.user, filters);

    response.status(200).json({ logs });
  },

  async getAuditLogById(request: Request, response: Response) {
    const log = await auditService.getAuditLogById(
      request.auth!.user,
      String(request.params.auditLogId),
    );

    response.status(200).json({ log });
  },
};
