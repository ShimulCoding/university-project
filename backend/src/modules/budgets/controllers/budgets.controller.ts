import type { Request, Response } from "express";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { budgetsService } from "../services/budgets.service";

export const budgetsController = {
  async listBudgets(request: Request, response: Response) {
    const result = await budgetsService.listBudgets(request.auth!.user, request.query);
    response.status(200).json(result);
  },

  async getBudgetById(request: Request, response: Response) {
    const budget = await budgetsService.getBudgetById(
      request.auth!.user,
      String(request.params.budgetId),
    );

    response.status(200).json({ budget });
  },

  async createBudget(request: Request, response: Response) {
    const budget = await budgetsService.createBudget(
      request.auth!.user,
      request.body,
      getRequestMetadata(request),
    );

    response.status(201).json({ budget });
  },

  async createBudgetRevision(request: Request, response: Response) {
    const budget = await budgetsService.createBudgetRevision(
      request.auth!.user,
      String(request.params.budgetId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(201).json({ budget });
  },

  async updateBudgetState(request: Request, response: Response) {
    const budget = await budgetsService.updateBudgetState(
      request.auth!.user,
      String(request.params.budgetId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ budget });
  },

  async activateBudget(request: Request, response: Response) {
    const budget = await budgetsService.activateBudget(
      request.auth!.user,
      String(request.params.budgetId),
      getRequestMetadata(request),
    );

    response.status(200).json({ budget });
  },
};
