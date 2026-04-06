import type { Request, Response } from "express";

import { budgetsService } from "../services/budgets.service";

export const budgetsController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(budgetsService.getOverview());
  },
};

