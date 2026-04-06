import { Prisma, type RoleCode } from "@prisma/client";

import { AppError } from "../../../utils/app-error";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { usersRepository } from "../../users/repositories/users.repository";
import { rolesRepository } from "../repositories/roles.repository";

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

  async listRoles() {
    await rolesRepository.syncCatalog();
    return rolesRepository.listRoles();
  },

  async listUserAssignments(userId: string) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found.");
    }

    const assignments = await rolesRepository.listUserAssignments(userId);

    return assignments.map((assignment) => ({
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
    }));
  },

  async assignRole(
    actorId: string,
    userId: string,
    roleCode: RoleCode,
    auditMetadata?: AuditMetadata,
  ) {
    await rolesRepository.syncCatalog();

    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found.");
    }

    const role = await rolesRepository.findByCode(roleCode);

    if (!role) {
      throw new AppError(404, "Role not found.");
    }

    const existingAssignment = await rolesRepository.findActiveAssignment(userId, role.id);

    if (existingAssignment) {
      throw new AppError(409, `User already has the ${roleCode} role.`);
    }

    const assignment = await rolesRepository.createAssignment({
      userId,
      roleId: role.id,
      assignedById: actorId,
    });

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
    });

    return mapAssignment(assignment);
  },

  async revokeAssignment(
    actorId: string,
    assignmentId: string,
    auditMetadata?: AuditMetadata,
  ) {
    const assignment = await rolesRepository.findAssignmentById(assignmentId);

    if (!assignment) {
      throw new AppError(404, "Role assignment not found.");
    }

    if (assignment.revokedAt) {
      throw new AppError(409, "Role assignment has already been revoked.");
    }

    const revokedAssignment = await rolesRepository.revokeAssignment(assignmentId);

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
    });

    return mapAssignment(revokedAssignment);
  },
};
