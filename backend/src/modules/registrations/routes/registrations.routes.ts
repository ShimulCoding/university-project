import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { registrationsController } from "../controllers/registrations.controller";
import {
  createRegistrationSchema,
  eventRegistrationsParamSchema,
  listRegistrationsSchema,
  registrationIdParamSchema,
} from "../validations/registrations.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/me",
  validateRequest(listRegistrationsSchema),
  asyncHandler(registrationsController.listMyRegistrations),
);
router.post(
  "/",
  validateRequest(createRegistrationSchema),
  asyncHandler(registrationsController.createRegistration),
);
router.get(
  "/event/:eventId",
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_MANAGEMENT_USER, RoleCode.FINANCIAL_CONTROLLER),
  validateRequest(eventRegistrationsParamSchema),
  asyncHandler(registrationsController.listEventRegistrations),
);
router.get(
  "/:registrationId",
  validateRequest(registrationIdParamSchema),
  asyncHandler(registrationsController.getRegistrationById),
);

export { router as registrationsRouter };
