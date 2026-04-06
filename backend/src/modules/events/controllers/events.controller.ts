import type { Request, Response } from "express";

import { eventsService } from "../services/events.service";

export const eventsController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(eventsService.getOverview());
  },
};

