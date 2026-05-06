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
  studentId: string | null;
  batch: string | null;
  department: string | null;
  section: string | null;
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
    studentId: user.studentId ?? null,
    batch: user.batch ?? null,
    department: user.department ?? null,
    section: user.section ?? null,
    status: user.status,
    roles: user.roles.map((assignment) => assignment.role.code),
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

