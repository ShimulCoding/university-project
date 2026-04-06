import type { Request, Response } from "express";

import { auditService } from "../services/audit.service";

export const auditController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(auditService.getOverview());
  },
};

