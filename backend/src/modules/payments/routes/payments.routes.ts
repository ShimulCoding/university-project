import { Router } from "express";
import multer from "multer";

import { RoleCode } from "@prisma/client";

import { uploadRules } from "../../../config/uploads";
import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { paymentsController } from "../controllers/payments.controller";
import {
  incomeRecordIdParamSchema,
  listIncomeRecordsSchema,
  listVerificationQueueSchema,
  paymentProofDecisionSchema,
} from "../validations/payments.validation";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: uploadRules.SUPPORTING_DOCUMENT.maxFileSizeBytes,
  },
});

router.use(authenticate);

router.post(
  "/registrations/:registrationId/proofs",
  upload.single("proofFile"),
  asyncHandler(paymentsController.submitPaymentProof),
);
router.get(
  "/verification-queue",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(listVerificationQueueSchema),
  asyncHandler(paymentsController.listVerificationQueue),
);
router.post(
  "/proofs/:paymentProofId/decision",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(paymentProofDecisionSchema),
  asyncHandler(paymentsController.decidePaymentProof),
);
router.get(
  "/income-records",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(listIncomeRecordsSchema),
  asyncHandler(paymentsController.listIncomeRecords),
);
router.get(
  "/income-records/:incomeRecordId",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(incomeRecordIdParamSchema),
  asyncHandler(paymentsController.getIncomeRecordById),
);
router.post(
  "/income-records",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  upload.single("evidenceFile"),
  asyncHandler(paymentsController.createIncomeRecord),
);

export { router as paymentsRouter };
