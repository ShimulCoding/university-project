import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { eventsController } from "../controllers/events.controller";
import {
  createEventSchema,
  eventLookupParamSchema,
  listManageEventsSchema,
  listPublicEventsSchema,
  updateEventSchema,
} from "../validations/events.validation";

const router = Router();

router.get(
  "/",
  validateRequest(listPublicEventsSchema),
  asyncHandler(eventsController.listPublicEvents),
);
router.get(
  "/manage/list",
  authenticate,
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
  ),
  validateRequest(listManageEventsSchema),
  asyncHandler(eventsController.listManageEvents),
);
router.get(
  "/manage/:eventLookupKey",
  authenticate,
  authorize(
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
  ),
  validateRequest(eventLookupParamSchema),
  asyncHandler(eventsController.getManageEvent),
);
router.post(
  "/",
  authenticate,
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_MANAGEMENT_USER),
  validateRequest(createEventSchema),
  asyncHandler(eventsController.createEvent),
);
router.patch(
  "/:eventLookupKey",
  authenticate,
  authorize(RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_MANAGEMENT_USER),
  validateRequest(updateEventSchema),
  asyncHandler(eventsController.updateEvent),
);
router.get(
  "/:eventLookupKey",
  validateRequest(eventLookupParamSchema),
  asyncHandler(eventsController.getPublicEvent),
);

export { router as eventsRouter };
