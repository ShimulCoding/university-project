import type { Request, Response } from "express";

import { usersService } from "../services/users.service";

export const usersController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(usersService.getOverview());
  },
};

