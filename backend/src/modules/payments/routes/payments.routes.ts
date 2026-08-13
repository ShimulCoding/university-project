import { Router } from "express";
import multer from "multer";

import { RoleCode } from "@prisma/client";

import { uploadRules } from "../../../config/uploads";
import { authenticate } from "../../../middlewares/authenticate";
import { authorizeEventScoped } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { paymentsController } from "../controllers/payments.controller";
import {
  incomeRecordIdParamSchema,
  listIncomeRecordsSchema,
  listVerificationQueueSchema,
  paymentProofDecisionSchema,
  voidIncomeRecordSchema,
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
  upload.array("proofFile", 15),
  asyncHandler(paymentsController.submitPaymentProof),
);
router.get(
  "/verification-queue",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(listVerificationQueueSchema),
  asyncHandler(paymentsController.listVerificationQueue),
);
router.post(
  "/proofs/:paymentProofId/decision",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(paymentProofDecisionSchema),
  asyncHandler(paymentsController.decidePaymentProof),
);
router.get(
  "/income-records",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(listIncomeRecordsSchema),
  asyncHandler(paymentsController.listIncomeRecords),
);
router.get(
  "/income-records/:incomeRecordId",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(incomeRecordIdParamSchema),
  asyncHandler(paymentsController.getIncomeRecordById),
);
router.post(
  "/income-records/:incomeRecordId/verify",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(incomeRecordIdParamSchema),
  asyncHandler(paymentsController.verifyIncomeRecord),
);
router.post(
  "/income-records/:incomeRecordId/void",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(voidIncomeRecordSchema),
  asyncHandler(paymentsController.voidIncomeRecord),
);
router.post(
  "/income-records",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  upload.array("evidenceFile", 15),
  asyncHandler(paymentsController.createIncomeRecord),
);

export { router as paymentsRouter };
