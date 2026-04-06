import type { Request, Response } from "express";

import { complaintsService } from "../services/complaints.service";

export const complaintsController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(complaintsService.getOverview());
  },
};

