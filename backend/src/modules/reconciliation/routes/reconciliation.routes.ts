import { Router } from "express";

import { reconciliationController } from "../controllers/reconciliation.controller";

const router = Router();

router.get("/", reconciliationController.getOverview);

export { router as reconciliationRouter };

