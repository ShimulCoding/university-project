import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { approvalsController } from "../controllers/approvals.controller";
import {
  approvalDecisionSchema,
  listApprovalQueueSchema,
} from "../validations/approvals.validation";

const router = Router();

router.use(authenticate);
router.use(authorize(RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER));

router.get(
  "/queue",
  validateRequest(listApprovalQueueSchema),
  asyncHandler(approvalsController.listApprovalQueue),
);
router.post(
  "/:entityType/:entityId/decisions",
  validateRequest(approvalDecisionSchema),
  asyncHandler(approvalsController.decide),
);

export { router as approvalsRouter };
