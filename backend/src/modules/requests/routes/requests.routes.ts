import { Router } from "express";
import multer from "multer";

import { RoleCode } from "@prisma/client";

import { uploadRules } from "../../../config/uploads";
import { authenticate } from "../../../middlewares/authenticate";
import { authorizeEventScoped } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { requireFinancialRequestKey } from "../../../utils/financial-idempotency";
import { requestsController } from "../controllers/requests.controller";
import { assertRequestUploadAccess } from "../services/requests.service";
import { authorizeOperationalUpload, uploadAdmission, uploadRateLimiter } from "../../../middlewares/upload-guard";
import {
  budgetRequestIdParamSchema,
  createBudgetRequestSchema,
  createExpenseRecordSchema,
  createExpenseRequestSchema,
  expenseRecordIdParamSchema,
  expenseRequestIdParamSchema,
  listExpenseRecordsSchema,
  listRequestsSchema,
  settleExpenseRecordSchema,
  updateBudgetRequestSchema,
  updateExpenseRequestSchema,
  voidExpenseRecordSchema,
} from "../validations/requests.validation";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fields: 30,
    parts: 45,
    fieldSize: 16 * 1024,
    files: 15,
    fileSize: uploadRules.SUPPORTING_DOCUMENT.maxFileSizeBytes,
  },
});

router.use(authenticate);

const requireRequestUpload = authorizeOperationalUpload([RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]);
const requireFinanceUpload = authorizeOperationalUpload([RoleCode.FINANCIAL_CONTROLLER]);

router.get(
  "/budget-requests/mine",
  validateRequest(listRequestsSchema),
  asyncHandler(requestsController.listMyBudgetRequests),
);
router.get(
  "/budget-requests",
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]),
  validateRequest(listRequestsSchema),
  asyncHandler(requestsController.listBudgetRequests),
);
router.get(
  "/budget-requests/:budgetRequestId",
  validateRequest(budgetRequestIdParamSchema),
  asyncHandler(requestsController.getBudgetRequestById),
);
router.post(
  "/budget-requests",
  requireRequestUpload,
  uploadRateLimiter,
  uploadAdmission,
  upload.array("supportingDocument", 15),
  validateRequest(createBudgetRequestSchema),
  asyncHandler(requestsController.createBudgetRequest),
);
router.patch(
  "/budget-requests/:budgetRequestId",
  requireRequestUpload,
  asyncHandler(async (request, _response, next) => {
    await assertRequestUploadAccess(request.auth!.user, { kind: "budget", requestId: String(request.params.budgetRequestId) }); next();
  }),
  uploadRateLimiter,
  uploadAdmission,
  upload.array("supportingDocument", 15),
  validateRequest(updateBudgetRequestSchema),
  asyncHandler(requestsController.updateBudgetRequest),
);
router.post(
  "/budget-requests/:budgetRequestId/submit",
  validateRequest(budgetRequestIdParamSchema),
  asyncHandler(requestsController.submitBudgetRequest),
);

router.get(
  "/expense-requests/mine",
  validateRequest(listRequestsSchema),
  asyncHandler(requestsController.listMyExpenseRequests),
);
router.get(
  "/expense-requests",
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]),
  validateRequest(listRequestsSchema),
  asyncHandler(requestsController.listExpenseRequests),
);
router.get(
  "/expense-requests/:expenseRequestId",
  validateRequest(expenseRequestIdParamSchema),
  asyncHandler(requestsController.getExpenseRequestById),
);
router.post(
  "/expense-requests",
  requireRequestUpload,
  uploadRateLimiter,
  uploadAdmission,
  upload.array("supportingDocument", 15),
  validateRequest(createExpenseRequestSchema),
  asyncHandler(requestsController.createExpenseRequest),
);
router.patch(
  "/expense-requests/:expenseRequestId",
  requireRequestUpload,
  asyncHandler(async (request, _response, next) => {
    await assertRequestUploadAccess(request.auth!.user, { kind: "expense", requestId: String(request.params.expenseRequestId) }); next();
  }),
  uploadRateLimiter,
  uploadAdmission,
  upload.array("supportingDocument", 15),
  validateRequest(updateExpenseRequestSchema),
  asyncHandler(requestsController.updateExpenseRequest),
);
router.post(
  "/expense-requests/:expenseRequestId/submit",
  validateRequest(expenseRequestIdParamSchema),
  asyncHandler(requestsController.submitExpenseRequest),
);

router.get(
  "/expense-records",
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]),
  validateRequest(listExpenseRecordsSchema),
  asyncHandler(requestsController.listExpenseRecords),
);
router.get(
  "/expense-records/:expenseRecordId",
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]),
  validateRequest(expenseRecordIdParamSchema),
  asyncHandler(requestsController.getExpenseRecordById),
);
router.post(
  "/expense-records",
  requireFinanceUpload,
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  requireFinancialRequestKey,
  uploadRateLimiter,
  uploadAdmission,
  upload.array("supportingDocument", 15),
  validateRequest(createExpenseRecordSchema),
  asyncHandler(requestsController.createExpenseRecord),
);
router.post(
  "/expense-records/:expenseRecordId/settle",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(settleExpenseRecordSchema),
  asyncHandler(requestsController.settleExpenseRecord),
);
router.post(
  "/expense-records/:expenseRecordId/void",
  authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]),
  validateRequest(voidExpenseRecordSchema),
  asyncHandler(requestsController.voidExpenseRecord),
);

export { router as requestsRouter };
