import type { Request, Response } from "express";

import { reconciliationService } from "../services/reconciliation.service";

export const reconciliationController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(reconciliationService.getOverview());
  },
};

