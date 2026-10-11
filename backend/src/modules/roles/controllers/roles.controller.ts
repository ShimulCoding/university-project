import { getRequestMetadata } from "../../../utils/request-metadata";
import type { Request, Response } from "express";

import { rolesService } from "../services/roles.service";

export const rolesController = {
  async listRoles(request: Request, response: Response) {
    const result = await rolesService.listRoles(request.query);

    response.status(200).json(result);
  },

  async listUserAssignments(request: Request, response: Response) {
    const result = await rolesService.listUserAssignments(
      String(request.params.userId),
      request.query,
    );

    response.status(200).json(result);
  },

  async assignRole(request: Request, response: Response) {
    const assignment = await rolesService.assignRole(
      request.auth!.userId,
      request.body.userId,
      request.body.roleCode,
      getRequestMetadata(request),
    );

    response.status(201).json({ assignment });
  },

  async revokeAssignment(request: Request, response: Response) {
    const assignment = await rolesService.revokeAssignment(
      request.auth!.userId,
      String(request.params.assignmentId),
      getRequestMetadata(request),
    );

    response.status(200).json({ assignment });
  },
};
