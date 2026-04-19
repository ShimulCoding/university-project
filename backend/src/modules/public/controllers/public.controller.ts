import type { Request, Response } from "express";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { publicService } from "../services/public.service";

export const publicController = {
  async listPublishedFinancialSummaries(request: Request, response: Response) {
    const result = await publicService.listPublishedFinancialSummaries(request.query);
    response.status(200).json(result);
  },

  async getPublishedFinancialSummary(request: Request, response: Response) {
    const summary = await publicService.getPublishedFinancialSummary(
      String(request.params.eventLookup),
    );

    response.status(200).json({ summary });
  },

  async publishFinancialSummary(request: Request, response: Response) {
    const summary = await publicService.publishFinancialSummary(
      request.auth!.user,
      String(request.params.reconciliationReportId),
      getRequestMetadata(request),
    );

    response.status(201).json({ summary });
  },
};
