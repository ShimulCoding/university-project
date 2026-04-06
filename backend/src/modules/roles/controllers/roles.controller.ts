import type { Request, Response } from "express";

import { rolesService } from "../services/roles.service";

export const rolesController = {
  async listRoles(_request: Request, response: Response) {
    const roles = await rolesService.listRoles();

    response.status(200).json({ roles });
  },

  async listUserAssignments(request: Request, response: Response) {
    const assignments = await rolesService.listUserAssignments(String(request.params.userId));

    response.status(200).json({ assignments });
  },

  async assignRole(request: Request, response: Response) {
    const assignment = await rolesService.assignRole(
      request.auth!.userId,
      request.body.userId,
      request.body.roleCode,
      {
        ipAddress: request.ip || undefined,
        userAgent: request.get("user-agent") || undefined,
        route: request.originalUrl,
        method: request.method,
      },
    );

    response.status(201).json({ assignment });
  },

  async revokeAssignment(request: Request, response: Response) {
    const assignment = await rolesService.revokeAssignment(
      request.auth!.userId,
      String(request.params.assignmentId),
      {
        ipAddress: request.ip || undefined,
        userAgent: request.get("user-agent") || undefined,
        route: request.originalUrl,
        method: request.method,
      },
    );

    response.status(200).json({ assignment });
  },
};
