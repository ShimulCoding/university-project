import type { Request, Response } from "express";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { paymentsService } from "../services/payments.service";
import {
  createIncomeRecordSchema,
  submitPaymentProofSchema,
} from "../validations/payments.validation";

export const paymentsController = {
  async submitPaymentProof(request: Request, response: Response) {
    const parsedRequest = submitPaymentProofSchema.parse({
      params: request.params,
      body: request.body,
    });

    const paymentProof = await paymentsService.submitPaymentProof(
      request.auth!.user,
      parsedRequest.params.registrationId,
      parsedRequest.body,
      request.file,
      getRequestMetadata(request),
    );

    response.status(201).json({ paymentProof });
  },

  async listVerificationQueue(request: Request, response: Response) {
    const result = await paymentsService.listVerificationQueue(request.auth!.user, request.query);
    response.status(200).json(result);
  },

  async decidePaymentProof(request: Request, response: Response) {
    const paymentProof = await paymentsService.decidePaymentProof(
      request.auth!.user,
      String(request.params.paymentProofId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ paymentProof });
  },

  async createIncomeRecord(request: Request, response: Response) {
    const parsedRequest = createIncomeRecordSchema.parse({
      body: request.body,
    });

    const incomeRecord = await paymentsService.createIncomeRecord(
      request.auth!.user,
      parsedRequest.body,
      request.file,
      getRequestMetadata(request),
    );

    response.status(201).json({ incomeRecord });
  },

  async listIncomeRecords(request: Request, response: Response) {
    const result = await paymentsService.listIncomeRecords(
      request.auth!.user,
      request.query,
    );
    response.status(200).json(result);
  },

  async getIncomeRecordById(request: Request, response: Response) {
    const incomeRecord = await paymentsService.getIncomeRecordById(
      request.auth!.user,
      String(request.params.incomeRecordId),
    );

    response.status(200).json({ incomeRecord });
  },
};
