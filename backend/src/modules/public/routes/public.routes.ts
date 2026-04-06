import { Router } from "express";

import { publicController } from "../controllers/public.controller";

const router = Router();

router.get("/", publicController.getOverview);

export { router as publicRouter };

