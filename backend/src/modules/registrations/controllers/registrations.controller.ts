import type { Request, Response } from "express";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { registrationsService } from "../services/registrations.service";

export const registrationsController = {
  async createRegistration(request: Request, response: Response) {
    const registration = await registrationsService.createRegistration(
      request.auth!.user,
      request.body,
      getRequestMetadata(request),
    );

    response.status(201).json({ registration });
  },

  async listMyRegistrations(request: Request, response: Response) {
    const result = await registrationsService.listMyRegistrations(
      request.auth!.userId,
      request.query,
    );
    response.status(200).json(result);
  },

  async getRegistrationById(request: Request, response: Response) {
    const registration = await registrationsService.getRegistrationById(
      request.auth!.user,
      String(request.params.registrationId),
    );

    response.status(200).json({ registration });
  },

  async listEventRegistrations(request: Request, response: Response) {
    const result = await registrationsService.listEventRegistrations(
      request.auth!.user,
      String(request.params.eventId),
      request.query,
    );

    response.status(200).json(result);
  },
};
