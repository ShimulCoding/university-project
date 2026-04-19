import type { Request, Response } from "express";
import type { ApprovalEntityType } from "@prisma/client";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { approvalsService } from "../services/approvals.service";

export const approvalsController = {
  async listApprovalQueue(request: Request, response: Response) {
    const result = await approvalsService.listApprovalQueue(request.auth!.user, request.query);
    response.status(200).json(result);
  },

  async decide(request: Request, response: Response) {
    const result = await approvalsService.decide(
      request.auth!.user,
      request.params.entityType as ApprovalEntityType,
      String(request.params.entityId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json(result);
  },
};
