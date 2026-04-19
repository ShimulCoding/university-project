import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
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
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ),
  validateRequest(listReconciliationReportsSchema),
  asyncHandler(reconciliationController.listReports),
);
router.post(
  "/generate",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(generateReconciliationReportSchema),
  asyncHandler(reconciliationController.generateReport),
);
router.get(
  "/:reportId",
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ),
  validateRequest(reconciliationReportIdParamSchema),
  asyncHandler(reconciliationController.getReportById),
);
router.post(
  "/:reportId/review",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(reconciliationReportIdParamSchema),
  asyncHandler(reconciliationController.reviewReport),
);
router.post(
  "/:reportId/finalize",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER),
  validateRequest(reconciliationReportIdParamSchema),
  asyncHandler(reconciliationController.finalizeReport),
);

export { router as reconciliationRouter };
