import type { Request, Response } from "express";

import { rolesService } from "../services/roles.service";

export const rolesController = {
  getOverview(_request: Request, response: Response) {
    response.status(200).json(rolesService.getOverview());
  },
};

