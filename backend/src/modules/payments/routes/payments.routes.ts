import { Router } from "express";

import { paymentsController } from "../controllers/payments.controller";

const router = Router();

router.get("/", paymentsController.getOverview);

export { router as paymentsRouter };

