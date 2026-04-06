import type { Request, Response } from "express";

import { publicService } from "../services/public.service";

export const publicController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(publicService.getOverview());
  },
};

