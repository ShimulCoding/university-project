-- Add event-specific internal team roles while keeping SYSTEM_ADMIN global.
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'EVENT_ADMIN';

CREATE TABLE "EventTeamMember" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleCode" "RoleCode" NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "EventTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventTeamMember_eventId_userId_roleCode_key"
    ON "EventTeamMember"("eventId", "userId", "roleCode");

CREATE INDEX "EventTeamMember_eventId_idx" ON "EventTeamMember"("eventId");
CREATE INDEX "EventTeamMember_userId_idx" ON "EventTeamMember"("userId");
CREATE INDEX "EventTeamMember_roleCode_idx" ON "EventTeamMember"("roleCode");

ALTER TABLE "EventTeamMember"
    ADD CONSTRAINT "EventTeamMember_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventTeamMember"
    ADD CONSTRAINT "EventTeamMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventTeamMember"
    ADD CONSTRAINT "EventTeamMember_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
