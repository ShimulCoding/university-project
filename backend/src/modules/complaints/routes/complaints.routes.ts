import { Router } from "express";

import { complaintsController } from "../controllers/complaints.controller";

const router = Router();

router.get("/", complaintsController.getOverview);

export { router as complaintsRouter };

