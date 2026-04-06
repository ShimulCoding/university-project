import type { Request, Response } from "express";

import { registrationsService } from "../services/registrations.service";

export const registrationsController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(registrationsService.getOverview());
  },
};

