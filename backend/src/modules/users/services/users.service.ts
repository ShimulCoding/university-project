import { AccountStatus, RoleCode } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import { governanceTransaction } from "../../../utils/governance-transaction";
import { assertEventTeamReady, requiredEventTeamRoles } from "../../../utils/event-team";
import { AppError } from "../../../utils/app-error";
import { assertGlobalAccountRole } from "../../../utils/event-scope";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { hashPassword } from "../../../utils/password";
import { normalizeEmail } from "../../../utils/normalize-email";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { rolesRepository } from "../../roles/repositories/roles.repository";
import { mapUserProfile } from "../users.mappers";
import { usersRepository } from "../repositories/users.repository";
import type { CreateUserInput, UserListFilters } from "../types/users.types";

export const usersService = {
  async listUsers(filters: UserListFilters) {
    const paginationOptions = getPaginationOptions(filters);
    const [users, totalItems] = await Promise.all([
      usersRepository.listUsers(paginationOptions),
      usersRepository.countUsers(),
    ]);

    return {
      users: users.map(mapUserProfile),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getCurrentUser(userId: string) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found.");
    }

    return mapUserProfile(user);
  },

  async getUserById(userId: string) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found.");
    }

    return mapUserProfile(user);
  },

  async createUser(
    actorId: string,
    input: CreateUserInput,
    auditMetadata?: AuditMetadata,
  ) {
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const roleCodes = [...new Set(input.roleCodes ?? [RoleCode.GENERAL_STUDENT])];

    roleCodes.forEach(assertGlobalAccountRole);

    const createdUser = await prisma.$transaction(async (tx) => {
      await rolesRepository.syncCatalog(tx);

      const user = await usersRepository.createUser(
        {
          fullName: input.fullName.trim(),
          email,
          passwordHash,
          status: input.status ?? AccountStatus.ACTIVE,
        },
        tx,
      );

      for (const roleCode of roleCodes) {
        const role = await rolesRepository.findByCode(roleCode, tx);

        if (!role) {
          throw new AppError(400, `Role ${roleCode} is not available.`);
        }

        await rolesRepository.createAssignment(
          {
            userId: user.id,
            roleId: role.id,
            assignedById: actorId,
          },
          tx,
        );
      }

      const freshUser = await usersRepository.findById(user.id, tx);

      if (!freshUser) {
        throw new AppError(500, "Failed to load the newly created user.");
      }

      await auditService.record({
        actorId,
        action: "users.create",
        entityType: "User",
        entityId: freshUser.id,
        summary: `Created user ${freshUser.email}`,
        context: { assignedRoles: roleCodes },
        ...auditMetadata,
      }, tx);
      return freshUser;
    });

    return mapUserProfile(createdUser);
  },

  async updateStatus(
    actorId: string,
    userId: string,
    status: AccountStatus,
    auditMetadata?: AuditMetadata,
  ) {
    const updatedUser = await governanceTransaction(async (tx) => {
      const existingUser = await usersRepository.findById(userId, tx);

      if (!existingUser) {
        throw new AppError(404, "User not found.");
      }

      if (
        status !== AccountStatus.ACTIVE &&
        existingUser.status === AccountStatus.ACTIVE &&
        existingUser.roles.some((assignment) => assignment.role.code === RoleCode.SYSTEM_ADMIN)
      ) {
        const remainingAdmins = await tx.user.count({
          where: {
            id: { not: userId },
            status: AccountStatus.ACTIVE,
            roles: { some: { revokedAt: null, role: { code: RoleCode.SYSTEM_ADMIN } } },
          },
        });
        if (remainingAdmins === 0) {
          throw new AppError(409, "The last active System Admin account cannot be deactivated.");
        }
      }

      if (status !== AccountStatus.ACTIVE && existingUser.status === AccountStatus.ACTIVE) {
        const affectedEvents = new Set(existingUser.eventTeamMemberships
          .filter((member) => requiredEventTeamRoles.includes(member.roleCode))
          .map((member) => member.eventId));
        for (const eventId of affectedEvents) {
          await assertEventTeamReady(eventId, tx, { userId });
        }
      }

      const updatedUser = await usersRepository.updateStatus(userId, status, tx);
      await auditService.record({
        actorId,
        action: "users.status.update",
        entityType: "User",
        entityId: userId,
        summary: `Changed user status to ${status}`,
        context: {
          previousStatus: existingUser.status,
          nextStatus: status,
        },
        ...auditMetadata,
      }, tx);
      return updatedUser;
    });

    return mapUserProfile(updatedUser);
  },
};
