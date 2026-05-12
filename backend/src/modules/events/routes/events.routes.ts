import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize, authorizeEventScoped } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { eventsController } from "../controllers/events.controller";
import {
  assignEventTeamMemberSchema,
  createEventSchema,
  eventTeamMemberParamSchema,
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
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
  ]),
  validateRequest(listManageEventsSchema),
  asyncHandler(eventsController.listManageEvents),
);
router.get(
  "/manage/:eventLookupKey",
  authenticate,
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
  ]),
  validateRequest(eventLookupParamSchema),
  asyncHandler(eventsController.getManageEvent),
);
router.post(
  "/",
  authenticate,
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(createEventSchema),
  asyncHandler(eventsController.createEvent),
);
router.patch(
  "/:eventLookupKey",
  authenticate,
  authorizeEventScoped([
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]),
  validateRequest(updateEventSchema),
  asyncHandler(eventsController.updateEvent),
);
router.post(
  "/:eventLookupKey/team-members",
  authenticate,
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(assignEventTeamMemberSchema),
  asyncHandler(eventsController.assignEventTeamMember),
);
router.delete(
  "/:eventLookupKey/team-members/:teamMemberId",
  authenticate,
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(eventTeamMemberParamSchema),
  asyncHandler(eventsController.revokeEventTeamMember),
);
router.get(
  "/:eventLookupKey",
  validateRequest(eventLookupParamSchema),
  asyncHandler(eventsController.getPublicEvent),
);

export { router as eventsRouter };
