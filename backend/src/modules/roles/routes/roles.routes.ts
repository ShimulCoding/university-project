import { Router } from "express";

import { RoleCode } from "@prisma/client";

import { authenticate } from "../../../middlewares/authenticate";
import { authorize } from "../../../middlewares/authorize";
import { validateRequest } from "../../../middlewares/validate-request";
import { asyncHandler } from "../../../utils/async-handler";
import { rolesController } from "../controllers/roles.controller";
import {
  assignRoleSchema,
  listRolesSchema,
  revokeRoleAssignmentSchema,
  userAssignmentsParamSchema,
} from "../validations/roles.validation";

const router = Router();

router.use(authenticate);

router.get("/", validateRequest(listRolesSchema), asyncHandler(rolesController.listRoles));
router.get(
  "/assignments/:userId",
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(userAssignmentsParamSchema),
  asyncHandler(rolesController.listUserAssignments),
);
router.post(
  "/assignments",
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(assignRoleSchema),
  asyncHandler(rolesController.assignRole),
);
router.delete(
  "/assignments/:assignmentId",
  authorize(RoleCode.SYSTEM_ADMIN),
  validateRequest(revokeRoleAssignmentSchema),
  asyncHandler(rolesController.revokeAssignment),
);

export { router as rolesRouter };
