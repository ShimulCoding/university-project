import type { Request, Response } from "express";

import { approvalsService } from "../services/approvals.service";

export const approvalsController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(approvalsService.getOverview());
  },
};

