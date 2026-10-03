-- Global operational roles do not identify which event a user should access.
-- Revoke them while preserving their assignment history; System Admins must
-- explicitly assign users to each event they are responsible for.
UPDATE "UserRole" AS assignment
SET "revokedAt" = CURRENT_TIMESTAMP
FROM "Role" AS role
WHERE assignment."roleId" = role."id"
  AND assignment."revokedAt" IS NULL
  AND role."code" IN (
    'EVENT_ADMIN',
    'FINANCIAL_CONTROLLER',
    'ORGANIZATIONAL_APPROVER',
    'EVENT_MANAGEMENT_USER',
    'COMPLAINT_REVIEW_AUTHORITY'
  );

-- Keep existing membership history, but retire invalid global-role memberships
-- and memberships held by System Admin accounts, which must remain separate.
UPDATE "EventTeamMember" AS membership
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE membership."revokedAt" IS NULL
  AND (
    membership."roleCode" NOT IN (
      'EVENT_ADMIN',
      'FINANCIAL_CONTROLLER',
      'ORGANIZATIONAL_APPROVER',
      'EVENT_MANAGEMENT_USER',
      'COMPLAINT_REVIEW_AUTHORITY'
    )
    OR EXISTS (
      SELECT 1
      FROM "UserRole" AS assignment
      JOIN "Role" AS role ON role."id" = assignment."roleId"
      WHERE assignment."userId" = membership."userId"
        AND assignment."revokedAt" IS NULL
        AND role."code" = 'SYSTEM_ADMIN'
    )
  );

-- Ensure future active memberships can only carry event-operational roles.
-- Revoked historical rows are retained for auditability.
ALTER TABLE "EventTeamMember"
  ADD CONSTRAINT "EventTeamMember_active_roleCode_event_scoped_check"
  CHECK (
    "revokedAt" IS NOT NULL
    OR "roleCode" IN (
      'EVENT_ADMIN',
      'FINANCIAL_CONTROLLER',
      'ORGANIZATIONAL_APPROVER',
      'EVENT_MANAGEMENT_USER',
      'COMPLAINT_REVIEW_AUTHORITY'
    )
  );
