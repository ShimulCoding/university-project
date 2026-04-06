import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { usersController } from "../controllers/users.controller";
import {
  createUserSchema,
  updateUserStatusSchema,
  userIdParamSchema,
} from "../validations/users.validation";

const router = Router();

router.use(authenticate);

router.get("/me", asyncHandler(usersController.getCurrentUser));
router.get("/", authorize(RoleCode.SYSTEM_ADMIN), asyncHandler(usersController.listUsers));
router.get(
  "/:userId",
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(userIdParamSchema),
  asyncHandler(usersController.getUserById),
);
router.post(
  "/",
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(createUserSchema),
  asyncHandler(usersController.createUser),
);
router.patch(
  "/:userId/status",
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(updateUserStatusSchema),
  asyncHandler(usersController.updateStatus),
);

export { router as usersRouter };

