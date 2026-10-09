import { AccountStatus, RoleCode } from "@prisma/client";

import type { DbClient } from "../types/database";
import { AppError } from "./app-error";

export const requiredEventTeamRoles: RoleCode[] = [
  RoleCode.EVENT_ADMIN,
  RoleCode.EVENT_MANAGEMENT_USER,
  RoleCode.FINANCIAL_CONTROLLER,
  RoleCode.ORGANIZATIONAL_APPROVER,
];

export async function assertEventTeamReady(
  eventId: string,
  db: DbClient,
  exclusions: { userId?: string; membershipId?: string } = {},
) {
  const memberships = await db.eventTeamMember.findMany({
    where: {
      eventId,
      revokedAt: null,
      ...(exclusions.userId ? { userId: { not: exclusions.userId } } : {}),
      ...(exclusions.membershipId ? { id: { not: exclusions.membershipId } } : {}),
      user: {
        status: AccountStatus.ACTIVE,
        roles: { none: { revokedAt: null, role: { code: RoleCode.SYSTEM_ADMIN } } },
      },
    },
    select: { userId: true, roleCode: true },
  });

  const missingRoles = requiredEventTeamRoles.filter(
    (roleCode) => !memberships.some((member) => member.roleCode === roleCode),
  );
  if (missingRoles.length) {
    throw new AppError(409, `Assign an active replacement before continuing. Missing event roles: ${missingRoles.join(", ")}.`);
  }

  const rolesByUser = new Map<string, RoleCode>();
  for (const member of memberships) {
    if (!requiredEventTeamRoles.includes(member.roleCode)) continue;
    const otherRole = rolesByUser.get(member.userId);
    if (otherRole && otherRole !== member.roleCode) {
      throw new AppError(409, "Required event roles must belong to separate accounts.");
    }
    rolesByUser.set(member.userId, member.roleCode);
  }
}
