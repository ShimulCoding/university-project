import type { Request, Response } from "express";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { reconciliationService } from "../services/reconciliation.service";

export const reconciliationController = {
  async listReports(request: Request, response: Response) {
    const reports = await reconciliationService.listReports(request.auth!.user, request.query);
    response.status(200).json({ reports });
  },

  async getReportById(request: Request, response: Response) {
    const report = await reconciliationService.getReportById(
      request.auth!.user,
      String(request.params.reportId),
    );

    response.status(200).json({ report });
  },

  async generateReport(request: Request, response: Response) {
    const report = await reconciliationService.generateReport(
      request.auth!.user,
      request.body,
      getRequestMetadata(request),
    );

    response.status(201).json({ report });
  },

  async reviewReport(request: Request, response: Response) {
    const report = await reconciliationService.reviewReport(
      request.auth!.user,
      String(request.params.reportId),
      getRequestMetadata(request),
    );

    response.status(200).json({ report });
  },

  async finalizeReport(request: Request, response: Response) {
    const report = await reconciliationService.finalizeReport(
      request.auth!.user,
      String(request.params.reportId),
      getRequestMetadata(request),
    );

    response.status(200).json({ report });
  },
};
