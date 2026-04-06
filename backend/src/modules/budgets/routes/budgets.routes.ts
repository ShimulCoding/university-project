import { Router } from "express";

import { budgetsController } from "../controllers/budgets.controller";

const router = Router();

router.get("/", budgetsController.getOverview);

export { router as budgetsRouter };

