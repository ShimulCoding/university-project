import { Router } from "express";

import { rolesController } from "../controllers/roles.controller";

const router = Router();

router.get("/", rolesController.getOverview);

export { router as rolesRouter };

