import { Router } from "express";

import { approvalsController } from "../controllers/approvals.controller";

const router = Router();

router.get("/", approvalsController.getOverview);

export { router as approvalsRouter };

