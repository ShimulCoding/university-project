import { Router } from "express";
import multer from "multer";

import { RoleCode } from "@prisma/client";

import { uploadRules } from "../../../config/uploads";
import { authenticate } from "../../../middlewares/authenticate";
import { authorizeEventScoped } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { complaintsController } from "../controllers/complaints.controller";
import { uploadAdmission, uploadRateLimiter } from "../../../middlewares/upload-guard";
import {
  closeComplaintSchema,
  complaintIdParamSchema,
  createComplaintSchema,
  escalateComplaintSchema,
  listComplaintQueueSchema,
  resolveComplaintSchema,
  reviewComplaintSchema,
  routeComplaintSchema,
} from "../validations/complaints.validation";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fields: 30,
    parts: 45,
    fieldSize: 16 * 1024,
    files: 15,
    fileSize: uploadRules.COMPLAINT_EVIDENCE.maxFileSizeBytes,
  },
});

const requireComplaintReviewer = authorizeEventScoped([
  RoleCode.SYSTEM_ADMIN,
  RoleCode.EVENT_ADMIN,
  RoleCode.COMPLAINT_REVIEW_AUTHORITY,
  RoleCode.ORGANIZATIONAL_APPROVER,
]);

router.use(authenticate);

router.get(
  "/mine",
  validateRequest(listComplaintQueueSchema),
  asyncHandler(complaintsController.listMyComplaints),
);
router.post(
  "/",
  uploadRateLimiter,
  uploadAdmission,
  upload.array("evidence", 15),
  validateRequest(createComplaintSchema),
  asyncHandler(complaintsController.createComplaint),
);

router.get(
  "/review-queue",
  requireComplaintReviewer,
  validateRequest(listComplaintQueueSchema),
  asyncHandler(complaintsController.listReviewQueue),
);

router.get(
  "/:complaintId",
  validateRequest(complaintIdParamSchema),
  asyncHandler(complaintsController.getComplaintById),
);
router.post(
  "/:complaintId/review",
  requireComplaintReviewer,
  validateRequest(reviewComplaintSchema),
  asyncHandler(complaintsController.startReview),
);
router.post(
  "/:complaintId/route",
  requireComplaintReviewer,
  validateRequest(routeComplaintSchema),
  asyncHandler(complaintsController.routeComplaint),
);
router.post(
  "/:complaintId/escalate",
  requireComplaintReviewer,
  validateRequest(escalateComplaintSchema),
  asyncHandler(complaintsController.escalateComplaint),
);
router.post(
  "/:complaintId/resolve",
  requireComplaintReviewer,
  validateRequest(resolveComplaintSchema),
  asyncHandler(complaintsController.resolveComplaint),
);
router.post(
  "/:complaintId/close",
  requireComplaintReviewer,
  validateRequest(closeComplaintSchema),
  asyncHandler(complaintsController.closeComplaint),
);

export { router as complaintsRouter };
