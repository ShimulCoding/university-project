import type { Request, Response } from "express";

import { auditService } from "../services/audit.service";

export const auditController = {
  async listAuditLogs(request: Request, response: Response) {
    const logs = await auditService.listAuditLogs({
      actorId: request.query.actorId as string | undefined,
      entityType: request.query.entityType as string | undefined,
      entityId: request.query.entityId as string | undefined,
      limit: Number(request.query.limit ?? 20),
    });

    response.status(200).json({ logs });
  },
};
