import type { Request, Response } from "express";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { requestsService } from "../services/requests.service";

export const requestsController = {
  async listMyBudgetRequests(request: Request, response: Response) {
    const budgetRequests = await requestsService.listMyBudgetRequests(request.auth!.user);
    response.status(200).json({ budgetRequests });
  },

  async listBudgetRequests(request: Request, response: Response) {
    const budgetRequests = await requestsService.listBudgetRequests(request.auth!.user, request.query);
    response.status(200).json({ budgetRequests });
  },

  async getBudgetRequestById(request: Request, response: Response) {
    const budgetRequest = await requestsService.getBudgetRequestById(
      request.auth!.user,
      String(request.params.budgetRequestId),
    );

    response.status(200).json({ budgetRequest });
  },

  async createBudgetRequest(request: Request, response: Response) {
    const budgetRequest = await requestsService.createBudgetRequest(
      request.auth!.user,
      request.body,
      request.file,
      getRequestMetadata(request),
    );

    response.status(201).json({ budgetRequest });
  },

  async updateBudgetRequest(request: Request, response: Response) {
    const budgetRequest = await requestsService.updateBudgetRequest(
      request.auth!.user,
      String(request.params.budgetRequestId),
      request.body,
      request.file,
      getRequestMetadata(request),
    );

    response.status(200).json({ budgetRequest });
  },

  async submitBudgetRequest(request: Request, response: Response) {
    const budgetRequest = await requestsService.submitBudgetRequest(
      request.auth!.user,
      String(request.params.budgetRequestId),
      getRequestMetadata(request),
    );

    response.status(200).json({ budgetRequest });
  },

  async listMyExpenseRequests(request: Request, response: Response) {
    const expenseRequests = await requestsService.listMyExpenseRequests(request.auth!.user);
    response.status(200).json({ expenseRequests });
  },

  async listExpenseRequests(request: Request, response: Response) {
    const expenseRequests = await requestsService.listExpenseRequests(
      request.auth!.user,
      request.query,
    );

    response.status(200).json({ expenseRequests });
  },

  async getExpenseRequestById(request: Request, response: Response) {
    const expenseRequest = await requestsService.getExpenseRequestById(
      request.auth!.user,
      String(request.params.expenseRequestId),
    );

    response.status(200).json({ expenseRequest });
  },

  async createExpenseRequest(request: Request, response: Response) {
    const expenseRequest = await requestsService.createExpenseRequest(
      request.auth!.user,
      request.body,
      request.file,
      getRequestMetadata(request),
    );

    response.status(201).json({ expenseRequest });
  },

  async updateExpenseRequest(request: Request, response: Response) {
    const expenseRequest = await requestsService.updateExpenseRequest(
      request.auth!.user,
      String(request.params.expenseRequestId),
      request.body,
      request.file,
      getRequestMetadata(request),
    );

    response.status(200).json({ expenseRequest });
  },

  async submitExpenseRequest(request: Request, response: Response) {
    const expenseRequest = await requestsService.submitExpenseRequest(
      request.auth!.user,
      String(request.params.expenseRequestId),
      getRequestMetadata(request),
    );

    response.status(200).json({ expenseRequest });
  },

  async listExpenseRecords(request: Request, response: Response) {
    const expenseRecords = await requestsService.listExpenseRecords(
      request.auth!.user,
      request.query,
    );

    response.status(200).json({ expenseRecords });
  },

  async getExpenseRecordById(request: Request, response: Response) {
    const expenseRecord = await requestsService.getExpenseRecordById(
      request.auth!.user,
      String(request.params.expenseRecordId),
    );

    response.status(200).json({ expenseRecord });
  },

  async createExpenseRecord(request: Request, response: Response) {
    const expenseRecord = await requestsService.createExpenseRecord(
      request.auth!.user,
      request.body,
      request.file,
      getRequestMetadata(request),
    );

    response.status(201).json({ expenseRecord });
  },

  async settleExpenseRecord(request: Request, response: Response) {
    const expenseRecord = await requestsService.settleExpenseRecord(
      request.auth!.user,
      String(request.params.expenseRecordId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ expenseRecord });
  },

  async voidExpenseRecord(request: Request, response: Response) {
    const expenseRecord = await requestsService.voidExpenseRecord(
      request.auth!.user,
      String(request.params.expenseRecordId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ expenseRecord });
  },
};
