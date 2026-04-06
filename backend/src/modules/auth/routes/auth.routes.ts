import { Router } from "express";

import { authenticate } from "../../../middlewares/authenticate";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { authController } from "../controllers/auth.controller";
import {
  bootstrapAdminSchema,
  loginSchema,
  registerSchema,
} from "../validations/auth.validation";

const router = Router();

router.post(
  "/bootstrap-admin",
  validateRequest(bootstrapAdminSchema),
  asyncHandler(authController.bootstrapAdmin),
);
router.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(authController.register),
);
router.post(
  "/login",
  validateRequest(loginSchema),
  asyncHandler(authController.login),
);
router.post("/refresh", asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));
router.get("/me", authenticate, asyncHandler(authController.getCurrentUser));

export { router as authRouter };
