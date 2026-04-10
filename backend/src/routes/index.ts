import { Router } from "express";

import { approvalsRouter } from "../modules/approvals";
import { auditRouter } from "../modules/audit";
import { authRouter } from "../modules/auth";
import { budgetsRouter } from "../modules/budgets";
import { complaintsRouter } from "../modules/complaints";
import { documentsRouter } from "../modules/documents";
import { eventsRouter } from "../modules/events";
import { paymentsRouter } from "../modules/payments";
import { publicRouter } from "../modules/public";
import { reconciliationRouter } from "../modules/reconciliation";
import { registrationsRouter } from "../modules/registrations";
import { requestsRouter } from "../modules/requests";
import { rolesRouter } from "../modules/roles";
import { usersRouter } from "../modules/users";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/roles", rolesRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/registrations", registrationsRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/documents", documentsRouter);
apiRouter.use("/budgets", budgetsRouter);
apiRouter.use("/requests", requestsRouter);
apiRouter.use("/approvals", approvalsRouter);
apiRouter.use("/complaints", complaintsRouter);
apiRouter.use("/reconciliation", reconciliationRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/audit", auditRouter);
