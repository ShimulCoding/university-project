import { Router } from "express";

import { registrationsController } from "../controllers/registrations.controller";

const router = Router();

router.get("/", registrationsController.getOverview);

export { router as registrationsRouter };

