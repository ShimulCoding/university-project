import type { Request, Response } from "express";

import { authService } from "../services/auth.service";

export const authController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(authService.getOverview());
  },
};

