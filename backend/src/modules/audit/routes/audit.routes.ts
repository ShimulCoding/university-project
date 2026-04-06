import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { auditController } from "../controllers/audit.controller";
import { auditLogIdParamSchema, listAuditLogsSchema } from "../validations/audit.validation";

const router = Router();

router.use(authenticate, authorize(RoleCode.SYSTEM_ADMIN));

router.get("/", validateRequest(listAuditLogsSchema), asyncHandler(auditController.listAuditLogs));
router.get(
  "/:auditLogId",
  validateRequest(auditLogIdParamSchema),
  asyncHandler(auditController.getAuditLogById),
);

export { router as auditRouter };
