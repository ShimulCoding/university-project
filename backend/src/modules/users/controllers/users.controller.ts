import type { Request, Response } from "express";

import { usersService } from "../services/users.service";

export const usersController = {
  async getCurrentUser(request: Request, response: Response) {
    const user = await usersService.getCurrentUser(request.auth!.userId);

    response.status(200).json({ user });
  },

  async listUsers(_request: Request, response: Response) {
    const users = await usersService.listUsers();

    response.status(200).json({ users });
  },

  async getUserById(request: Request, response: Response) {
    const user = await usersService.getUserById(String(request.params.userId));

    response.status(200).json({ user });
  },

  async createUser(request: Request, response: Response) {
    const user = await usersService.createUser(request.auth!.userId, request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    response.status(201).json({ user });
  },

  async updateStatus(request: Request, response: Response) {
    const user = await usersService.updateStatus(
      request.auth!.userId,
      String(request.params.userId),
      request.body.status,
      {
        ipAddress: request.ip || undefined,
        userAgent: request.get("user-agent") || undefined,
        route: request.originalUrl,
        method: request.method,
      },
    );

    response.status(200).json({ user });
  },
};
