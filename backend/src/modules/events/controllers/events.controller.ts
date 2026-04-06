import type { Request, Response } from "express";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { eventsService } from "../services/events.service";

export const eventsController = {
  async listPublicEvents(request: Request, response: Response) {
    const events = await eventsService.listPublicEvents(request.query);
    response.status(200).json({ events });
  },

  async getPublicEvent(request: Request, response: Response) {
    const event = await eventsService.getPublicEvent(String(request.params.eventLookupKey));
    response.status(200).json({ event });
  },

  async listManageEvents(request: Request, response: Response) {
    const events = await eventsService.listManageEvents(request.query);
    response.status(200).json({ events });
  },

  async getManageEvent(request: Request, response: Response) {
    const event = await eventsService.getManageEvent(String(request.params.eventLookupKey));
    response.status(200).json({ event });
  },

  async createEvent(request: Request, response: Response) {
    const event = await eventsService.createEvent(
      request.auth!.userId,
      request.body,
      getRequestMetadata(request),
    );

    response.status(201).json({ event });
  },

  async updateEvent(request: Request, response: Response) {
    const event = await eventsService.updateEvent(
      request.auth!.userId,
      String(request.params.eventLookupKey),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ event });
  },
};
