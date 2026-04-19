import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { publicController } from "../controllers/public.controller";
import {
  listPublicSummariesSchema,
  publicSummaryLookupParamSchema,
  publishPublicSummaryParamSchema,
  unpublishPublicSummaryParamSchema,
} from "../validations/public.validation";

const router = Router();

router.get(
  "/financial-summaries",
  validateRequest(listPublicSummariesSchema),
  asyncHandler(publicController.listPublishedFinancialSummaries),
);
router.get(
  "/financial-summaries/:eventLookup",
  validateRequest(publicSummaryLookupParamSchema),
  asyncHandler(publicController.getPublishedFinancialSummary),
);
router.post(
  "/manage/financial-summaries/:publicSummaryId/unpublish",
  authenticate,
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER),
  validateRequest(unpublishPublicSummaryParamSchema),
  asyncHandler(publicController.unpublishFinancialSummary),
);
router.post(
  "/manage/financial-summaries/:reconciliationReportId/publish",
  authenticate,
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER),
  validateRequest(publishPublicSummaryParamSchema),
  asyncHandler(publicController.publishFinancialSummary),
);

export { router as publicRouter };
