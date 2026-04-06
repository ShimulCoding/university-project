import { Prisma, type AccountStatus, type RoleCode } from "@prisma/client";

export const userWithActiveRolesInclude = Prisma.validator<Prisma.UserInclude>()({
  roles: {
    where: {
      revokedAt: null,
    },
    include: {
      role: true,
    },
  },
});

export type UserWithActiveRoles = Prisma.UserGetPayload<{
  include: typeof userWithActiveRolesInclude;
}>;

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  status: AccountStatus;
  roles: RoleCode[];
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function mapUserProfile(user: UserWithActiveRoles): UserProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    status: user.status,
    roles: user.roles.map((assignment) => assignment.role.code),
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

