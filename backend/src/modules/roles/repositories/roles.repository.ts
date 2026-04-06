import type { RoleCode } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { roleCatalog } from "../role-catalog";

export const rolesRepository = {
  async syncCatalog(db: DbClient = prisma) {
    for (const role of roleCatalog) {
      await db.role.upsert({
        where: { code: role.code },
        update: {
          name: role.name,
          description: role.description,
          isSystem: true,
        },
        create: {
          code: role.code,
          name: role.name,
          description: role.description,
          isSystem: true,
        },
      });
    }
  },

  listRoles(db: DbClient = prisma) {
    return db.role.findMany({
      orderBy: {
        name: "asc",
      },
    });
  },

  findByCode(code: RoleCode, db: DbClient = prisma) {
    return db.role.findUnique({
      where: { code },
    });
  },

  findActiveAssignment(userId: string, roleId: string, db: DbClient = prisma) {
    return db.userRole.findFirst({
      where: {
        userId,
        roleId,
        revokedAt: null,
      },
    });
  },

  createAssignment(
    data: {
      userId: string;
      roleId: string;
      assignedById?: string;
    },
    db: DbClient = prisma,
  ) {
    return db.userRole.create({
      data,
      include: {
        role: true,
        user: true,
        assignedBy: true,
      },
    });
  },

  listUserAssignments(userId: string, db: DbClient = prisma) {
    return db.userRole.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      include: {
        role: true,
        assignedBy: true,
      },
      orderBy: {
        assignedAt: "asc",
      },
    });
  },

  findAssignmentById(assignmentId: string, db: DbClient = prisma) {
    return db.userRole.findUnique({
      where: { id: assignmentId },
      include: {
        role: true,
        user: true,
        assignedBy: true,
      },
    });
  },

  revokeAssignment(assignmentId: string, db: DbClient = prisma) {
    return db.userRole.update({
      where: { id: assignmentId },
      data: {
        revokedAt: new Date(),
      },
      include: {
        role: true,
        user: true,
        assignedBy: true,
      },
    });
  },
};
