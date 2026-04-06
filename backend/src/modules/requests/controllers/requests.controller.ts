import type { Request, Response } from "express";

import { requestsService } from "../services/requests.service";

export const requestsController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(requestsService.getOverview());
  },
};

