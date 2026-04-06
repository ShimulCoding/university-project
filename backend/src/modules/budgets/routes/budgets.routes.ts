import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { budgetsController } from "../controllers/budgets.controller";
import {
  budgetIdParamSchema,
  createBudgetSchema,
  listBudgetsSchema,
  reviseBudgetSchema,
  updateBudgetStateSchema,
} from "../validations/budgets.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ),
  validateRequest(listBudgetsSchema),
  asyncHandler(budgetsController.listBudgets),
);
router.get(
  "/:budgetId",
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ),
  validateRequest(budgetIdParamSchema),
  asyncHandler(budgetsController.getBudgetById),
);
router.post(
  "/",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(createBudgetSchema),
  asyncHandler(budgetsController.createBudget),
);
router.post(
  "/:budgetId/revisions",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(reviseBudgetSchema),
  asyncHandler(budgetsController.createBudgetRevision),
);
router.patch(
  "/:budgetId/state",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(updateBudgetStateSchema),
  asyncHandler(budgetsController.updateBudgetState),
);
router.post(
  "/:budgetId/activate",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(budgetIdParamSchema),
  asyncHandler(budgetsController.activateBudget),
);

export { router as budgetsRouter };
