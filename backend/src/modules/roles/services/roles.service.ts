import { AccountStatus, Prisma, RoleCode } from "@prisma/client";

import { governanceTransaction } from "../../../utils/governance-transaction";
import { AppError } from "../../../utils/app-error";
import { assertGlobalAccountRole } from "../../../utils/event-scope";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { usersRepository } from "../../users/repositories/users.repository";
import { rolesRepository } from "../repositories/roles.repository";
import type { RoleListFilters } from "../types/roles.types";

type RoleAssignmentRecord = Prisma.UserRoleGetPayload<{
  include: {
    role: true;
    user: true;
    assignedBy: true;
  };
}>;

function mapAssignment(assignment: RoleAssignmentRecord) {
  return {
    id: assignment.id,
    userId: assignment.userId,
    roleCode: assignment.role.code,
    roleName: assignment.role.name,
    assignedAt: assignment.assignedAt,
    revokedAt: assignment.revokedAt,
    assignedBy: assignment.assignedBy
      ? {
          id: assignment.assignedBy.id,
          fullName: assignment.assignedBy.fullName,
          email: assignment.assignedBy.email,
        }
      : null,
  };
}

export const rolesService = {
  ensureRoleCatalog() {
    return rolesRepository.syncCatalog();
  },

  async listRoles(filters: RoleListFilters) {
    const paginationOptions = getPaginationOptions(filters);
    const [roles, totalItems] = await Promise.all([
      rolesRepository.listRoles(paginationOptions),
      rolesRepository.countRoles(),
    ]);

    return {
      roles,
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async listUserAssignments(userId: string, filters: RoleListFilters) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found.");
    }

    const paginationOptions = getPaginationOptions(filters);
    const [assignments, totalItems] = await Promise.all([
      rolesRepository.listUserAssignments(userId, paginationOptions),
      rolesRepository.countUserAssignments(userId),
    ]);

    return {
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        userId: assignment.userId,
        roleCode: assignment.role.code,
        roleName: assignment.role.name,
        assignedAt: assignment.assignedAt,
        revokedAt: assignment.revokedAt,
        assignedBy: assignment.assignedBy
          ? {
              id: assignment.assignedBy.id,
              fullName: assignment.assignedBy.fullName,
              email: assignment.assignedBy.email,
            }
          : null,
      })),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async assignRole(
    actorId: string,
    userId: string,
    roleCode: RoleCode,
    auditMetadata?: AuditMetadata,
  ) {
    assertGlobalAccountRole(roleCode);
    const assignment = await governanceTransaction(async (tx) => {
      await rolesRepository.syncCatalog(tx);
      const user = await usersRepository.findById(userId, tx);

      if (!user) {
        throw new AppError(404, "User not found.");
      }
      if (roleCode === RoleCode.GENERAL_STUDENT && !user.studentId) {
        throw new AppError(409, "Add a Student ID to this account profile before granting student access.");
      }

      if (roleCode === RoleCode.SYSTEM_ADMIN && user.eventTeamMemberships.length > 0) {
        throw new AppError(
          409,
          "Revoke this user's active event team assignments before granting System Admin access.",
        );
      }

      const role = await rolesRepository.findByCode(roleCode, tx);

      if (!role) {
        throw new AppError(404, "Role not found.");
      }

      const existingAssignment = await rolesRepository.findActiveAssignment(userId, role.id, tx);

      if (existingAssignment) {
        throw new AppError(409, `User already has the ${roleCode} role.`);
      }

      const assignment = await rolesRepository.createAssignment({
        userId,
        roleId: role.id,
        assignedById: actorId,
      }, tx);
      await auditService.record({
        actorId,
        action: "roles.assign",
        entityType: "UserRole",
        entityId: assignment.id,
        summary: `Assigned ${roleCode} to ${user.email}`,
        context: {
          userId,
          roleCode,
        },
        ...auditMetadata,
      }, tx);
      return assignment;
    }, { id: actorId, roles: [RoleCode.SYSTEM_ADMIN], eventRoles: [] });

    return mapAssignment(assignment);
  },

  async revokeAssignment(
    actorId: string,
    assignmentId: string,
    auditMetadata?: AuditMetadata,
  ) {
    const revokedAssignment = await governanceTransaction(async (tx) => {
      const assignment = await rolesRepository.findAssignmentById(assignmentId, tx);

      if (!assignment) {
        throw new AppError(404, "Role assignment not found.");
      }

      if (assignment.revokedAt) {
        throw new AppError(409, "Role assignment has already been revoked.");
      }

      if (
        assignment.role.code === RoleCode.SYSTEM_ADMIN &&
        assignment.user.status === AccountStatus.ACTIVE
      ) {
        const remainingAdmins = await tx.user.count({
          where: {
            status: AccountStatus.ACTIVE,
            roles: { some: { id: { not: assignmentId }, revokedAt: null, role: { code: RoleCode.SYSTEM_ADMIN } } },
          },
        });
        if (remainingAdmins === 0) {
          throw new AppError(409, "The last active System Admin assignment cannot be revoked.");
        }
      }

      const revokedAssignment = await rolesRepository.revokeAssignment(assignmentId, tx);
      await auditService.record({
        actorId,
        action: "roles.revoke",
        entityType: "UserRole",
        entityId: revokedAssignment.id,
        summary: `Revoked ${revokedAssignment.role.code} from ${revokedAssignment.user.email}`,
        context: {
          userId: revokedAssignment.userId,
          roleCode: revokedAssignment.role.code,
        },
        ...auditMetadata,
      }, tx);
      return revokedAssignment;
    }, { id: actorId, roles: [RoleCode.SYSTEM_ADMIN], eventRoles: [] });

    return mapAssignment(revokedAssignment);
  },
};
