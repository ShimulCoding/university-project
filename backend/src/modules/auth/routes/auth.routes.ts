import { Router } from "express";

import { authenticate } from "../../../middlewares/authenticate";
import { authenticateRefreshSession } from "../../../middlewares/authenticate-refresh-session";
import { validateRequest } from "../../../middlewares/validate-request";
import { authRateLimiter, sessionRateLimiter } from "../../../config/rate-limit";
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
  authRateLimiter,
  validateRequest(bootstrapAdminSchema),
  asyncHandler(authController.bootstrapAdmin),
);
router.post(
  "/register",
  authRateLimiter,
  validateRequest(registerSchema),
  asyncHandler(authController.register),
);
router.post(
  "/login",
  authRateLimiter,
  validateRequest(loginSchema),
  asyncHandler(authController.login),
);
router.post("/refresh", sessionRateLimiter, asyncHandler(authController.refresh));
router.post(
  "/logout",
  sessionRateLimiter,
  authenticateRefreshSession,
  asyncHandler(authController.logout),
);
router.get("/me", authenticate, asyncHandler(authController.getCurrentUser));

export { router as authRouter };
