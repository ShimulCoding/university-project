import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorizeEventScoped } from "../../../middlewares/authorize";
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
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]),
  validateRequest(listBudgetsSchema),
  asyncHandler(budgetsController.listBudgets),
);
router.get(
  "/:budgetId",
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]),
  validateRequest(budgetIdParamSchema),
  asyncHandler(budgetsController.getBudgetById),
);
router.post(
  "/",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]),
  validateRequest(createBudgetSchema),
  asyncHandler(budgetsController.createBudget),
);
router.post(
  "/:budgetId/revisions",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]),
  validateRequest(reviseBudgetSchema),
  asyncHandler(budgetsController.createBudgetRevision),
);
router.patch(
  "/:budgetId/state",
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
    RoleCode.ORGANIZATIONAL_APPROVER,
  ]),
  validateRequest(updateBudgetStateSchema),
  asyncHandler(budgetsController.updateBudgetState),
);
router.post(
  "/:budgetId/activate",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]),
  validateRequest(budgetIdParamSchema),
  asyncHandler(budgetsController.activateBudget),
);

export { router as budgetsRouter };
