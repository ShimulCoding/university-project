import type { Request, Response } from "express";

import { paymentsService } from "../services/payments.service";

export const paymentsController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(paymentsService.getOverview());
  },
};

