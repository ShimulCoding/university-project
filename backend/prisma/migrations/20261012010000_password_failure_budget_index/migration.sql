-- Bounded password/MFA failure counts use this existing-data-preserving index.
CREATE INDEX "AuditLog_actorId_action_createdAt_idx" ON "AuditLog"("actorId", "action", "createdAt");
