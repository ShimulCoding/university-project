import { Router } from "express";

import { authenticate } from "../../../middlewares/authenticate";
import { validateRequest } from "../../../middlewares/validate-request";
import { authRateLimiter, loginRateLimiter, sessionRateLimiter } from "../../../config/rate-limit";
import { asyncHandler } from "../../../utils/async-handler";
import { authController } from "../controllers/auth.controller";
import {
  bootstrapAdminSchema,
  eventTeamLoginSchema,
  forgotPasswordSchema,
  internalLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateEmailSchema,
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
  loginRateLimiter,
  validateRequest(loginSchema),
  asyncHandler(authController.login),
);
router.post(
  "/internal-login",
  loginRateLimiter,
  validateRequest(internalLoginSchema),
  asyncHandler(authController.internalLogin),
);
router.post(
  "/event-team-login",
  loginRateLimiter,
  validateRequest(eventTeamLoginSchema),
  asyncHandler(authController.eventTeamLogin),
);
router.post(
  "/forgot-password",
  authRateLimiter,
  validateRequest(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);
router.post(
  "/reset-password",
  authRateLimiter,
  validateRequest(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);
router.post("/refresh", sessionRateLimiter, asyncHandler(authController.refresh));
router.post(
  "/logout",
  sessionRateLimiter,
  asyncHandler(authController.logout),
);
router.get("/me", authenticate, asyncHandler(authController.getCurrentUser));
router.patch(
  "/update-email",
  authenticate,
  validateRequest(updateEmailSchema),
  asyncHandler(authController.updateEmail),
);

export { router as authRouter };
