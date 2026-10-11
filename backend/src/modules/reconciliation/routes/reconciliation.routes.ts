import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { admitReport, sensitiveActionLimits } from "../../../middlewares/sensitive-action-limits";
import { authorizeEventScoped } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { reconciliationController } from "../controllers/reconciliation.controller";
import {
  generateReconciliationReportSchema,
  listReconciliationReportsSchema,
  reconciliationReportIdParamSchema,
} from "../validations/reconciliation.validation";

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
  validateRequest(listReconciliationReportsSchema),
  asyncHandler(reconciliationController.listReports),
);
router.post(
  "/generate",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(generateReconciliationReportSchema),
  sensitiveActionLimits.reports,
  admitReport(reconciliationController.generateReport),
);
router.get(
  "/:reportId",
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]),
  validateRequest(reconciliationReportIdParamSchema),
  asyncHandler(reconciliationController.getReportById),
);
router.post(
  "/:reportId/review",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(reconciliationReportIdParamSchema),
  asyncHandler(reconciliationController.reviewReport),
);
router.post(
  "/:reportId/finalize",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]),
  validateRequest(reconciliationReportIdParamSchema),
  asyncHandler(reconciliationController.finalizeReport),
);

export { router as reconciliationRouter };
