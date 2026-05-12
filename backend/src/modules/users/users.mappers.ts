import { Prisma, type AccountStatus, type EventStatus, type RoleCode } from "@prisma/client";

export const userWithActiveRolesInclude = Prisma.validator<Prisma.UserInclude>()({
  roles: {
    where: {
      revokedAt: null,
    },
    include: {
      role: true,
    },
  },
  eventTeamMemberships: {
    where: {
      revokedAt: null,
    },
    select: {
      eventId: true,
      roleCode: true,
      assignedAt: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
        },
      },
    },
    orderBy: {
      assignedAt: "desc",
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
  eventRoles: Array<{
    eventId: string;
    roleCode: RoleCode;
    assignedAt: Date;
    event: {
      id: string;
      title: string;
      slug: string;
      status: EventStatus;
    };
  }>;
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
    eventRoles: user.eventTeamMemberships.map((membership) => ({
      eventId: membership.eventId,
      roleCode: membership.roleCode,
      assignedAt: membership.assignedAt,
      event: {
        id: membership.event.id,
        title: membership.event.title,
        slug: membership.event.slug,
        status: membership.event.status,
      },
    })),
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
