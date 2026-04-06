import { Router } from "express";

import { requestsController } from "../controllers/requests.controller";

const router = Router();

router.get("/", requestsController.getOverview);

export { router as requestsRouter };

