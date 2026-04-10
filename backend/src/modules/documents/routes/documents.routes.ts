import { Router } from "express";

import { authenticate } from "../../../middlewares/authenticate";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { documentsController } from "../controllers/documents.controller";
import { protectedDocumentParamSchema } from "../validations/documents.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/:documentId/open",
  validateRequest(protectedDocumentParamSchema),
  asyncHandler(documentsController.openProtectedDocument),
);

export { router as documentsRouter };
