import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorizeEventScoped } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { approvalsController } from "../controllers/approvals.controller";
import {
  approvalDecisionSchema,
  listApprovalQueueSchema,
} from "../validations/approvals.validation";

const router = Router();

router.use(authenticate);


router.get(
  "/queue",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]),
  validateRequest(listApprovalQueueSchema),
  asyncHandler(approvalsController.listApprovalQueue),
);
router.post(
  "/:entityType/:entityId/decisions",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]),
  validateRequest(approvalDecisionSchema),
  asyncHandler(approvalsController.decide),
);

export { router as approvalsRouter };
