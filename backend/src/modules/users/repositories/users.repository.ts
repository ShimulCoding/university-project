import type { AccountStatus } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { PaginationOptions } from "../../../utils/pagination";
import { userWithActiveRolesInclude } from "../users.mappers";

export const usersRepository = {
  countUsers(db: DbClient = prisma) {
    return db.user.count();
  },

  createUser(
    data: {
      fullName: string;
      email: string;
      passwordHash: string;
      status?: AccountStatus;
    },
    db: DbClient = prisma,
  ) {
    return db.user.create({
      data,
      include: userWithActiveRolesInclude,
    });
  },

  findByEmail(email: string, db: DbClient = prisma) {
    return db.user.findUnique({
      where: { email },
      include: userWithActiveRolesInclude,
    });
  },

  findById(userId: string, db: DbClient = prisma) {
    return db.user.findUnique({
      where: { id: userId },
      include: userWithActiveRolesInclude,
    });
  },

  listUsers(pagination?: PaginationOptions, db: DbClient = prisma) {
    return db.user.findMany({
      include: userWithActiveRolesInclude,
      orderBy: {
        createdAt: "desc",
      },
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  updateStatus(userId: string, status: AccountStatus, db: DbClient = prisma) {
    return db.user.update({
      where: { id: userId },
      data: { status },
      include: userWithActiveRolesInclude,
    });
  },

  updateLastLogin(userId: string, db: DbClient = prisma) {
    return db.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      include: userWithActiveRolesInclude,
    });
  },
};
