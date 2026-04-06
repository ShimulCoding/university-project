import { Router } from "express";
import multer from "multer";

import { RoleCode } from "@prisma/client";

import { uploadRules } from "../../../config/uploads";
import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { requestsController } from "../controllers/requests.controller";
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
    fileSize: uploadRules.SUPPORTING_DOCUMENT.maxFileSizeBytes,
  },
});

router.use(authenticate);

router.get("/budget-requests/mine", asyncHandler(requestsController.listMyBudgetRequests));
router.get(
  "/budget-requests",
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ),
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
  upload.single("supportingDocument"),
  validateRequest(createBudgetRequestSchema),
  asyncHandler(requestsController.createBudgetRequest),
);
router.patch(
  "/budget-requests/:budgetRequestId",
  upload.single("supportingDocument"),
  validateRequest(updateBudgetRequestSchema),
  asyncHandler(requestsController.updateBudgetRequest),
);
router.post(
  "/budget-requests/:budgetRequestId/submit",
  validateRequest(budgetRequestIdParamSchema),
  asyncHandler(requestsController.submitBudgetRequest),
);

router.get("/expense-requests/mine", asyncHandler(requestsController.listMyExpenseRequests));
router.get(
  "/expense-requests",
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ),
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
  upload.single("supportingDocument"),
  validateRequest(createExpenseRequestSchema),
  asyncHandler(requestsController.createExpenseRequest),
);
router.patch(
  "/expense-requests/:expenseRequestId",
  upload.single("supportingDocument"),
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
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ),
  validateRequest(listExpenseRecordsSchema),
  asyncHandler(requestsController.listExpenseRecords),
);
router.get(
  "/expense-records/:expenseRecordId",
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ),
  validateRequest(expenseRecordIdParamSchema),
  asyncHandler(requestsController.getExpenseRecordById),
);
router.post(
  "/expense-records",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  upload.single("supportingDocument"),
  validateRequest(createExpenseRecordSchema),
  asyncHandler(requestsController.createExpenseRecord),
);
router.post(
  "/expense-records/:expenseRecordId/settle",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(settleExpenseRecordSchema),
  asyncHandler(requestsController.settleExpenseRecord),
);
router.post(
  "/expense-records/:expenseRecordId/void",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(voidExpenseRecordSchema),
  asyncHandler(requestsController.voidExpenseRecord),
);

export { router as requestsRouter };
