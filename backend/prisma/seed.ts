import { AccountStatus, EventStatus, PrismaClient, RoleCode } from "@prisma/client";
import bcrypt from "bcryptjs";

import { roleCatalog } from "../src/modules/roles/role-catalog";

const prisma = new PrismaClient();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function seedRoles() {
  for (const role of roleCatalog) {
    await prisma.role.upsert({
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
}

async function seedAdminUser() {
  const fullName = process.env.SEED_ADMIN_FULL_NAME?.trim();
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!fullName || !email || !password) {
    console.log("Seed admin values are incomplete. Skipping admin user seed.");
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      fullName,
      passwordHash,
      status: AccountStatus.ACTIVE,
    },
    create: {
      fullName,
      email: normalizedEmail,
      passwordHash,
      status: AccountStatus.ACTIVE,
    },
  });

  const systemAdminRole = await prisma.role.findUnique({
    where: { code: RoleCode.SYSTEM_ADMIN },
  });

  if (!systemAdminRole) {
    throw new Error("SYSTEM_ADMIN role was not found during seed.");
  }

  const existingAssignment = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      roleId: systemAdminRole.id,
      revokedAt: null,
    },
  });

  if (!existingAssignment) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: systemAdminRole.id,
      },
    });
  }

  console.log(`Seeded system admin user: ${normalizedEmail}`);
}

/**
 * Create demo internal users and assign them to a demo event.
 * Each demo user gets both a global role AND an event-scoped team assignment.
 */
async function seedDemoEventTeam() {
  const demoPassword = process.env.SEED_DEMO_PASSWORD?.trim() || "DemoPass123!";
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const demoUsers = [
    {
      fullName: "Finance Controller (Demo)",
      email: "demo.finance@example.com",
      globalRoleCode: RoleCode.FINANCIAL_CONTROLLER,
      eventRoleCode: RoleCode.FINANCIAL_CONTROLLER,
    },
    {
      fullName: "Organizational Approver (Demo)",
      email: "demo.approver@example.com",
      globalRoleCode: RoleCode.ORGANIZATIONAL_APPROVER,
      eventRoleCode: RoleCode.ORGANIZATIONAL_APPROVER,
    },
    {
      fullName: "Event Manager (Demo)",
      email: "demo.event.manager@example.com",
      globalRoleCode: RoleCode.EVENT_MANAGEMENT_USER,
      eventRoleCode: RoleCode.EVENT_MANAGEMENT_USER,
    },
    {
      fullName: "Event Admin (Demo)",
      email: "demo.event.admin@example.com",
      globalRoleCode: RoleCode.EVENT_ADMIN,
      eventRoleCode: RoleCode.EVENT_ADMIN,
    },
  ];

  // Create or find users with their global roles
  const userRecords: Array<{ id: string; email: string; eventRoleCode: RoleCode }> = [];

  for (const demoUser of demoUsers) {
    const email = normalizeEmail(demoUser.email);
    const user = await prisma.user.upsert({
      where: { email },
      update: { fullName: demoUser.fullName, passwordHash, status: AccountStatus.ACTIVE },
      create: {
        fullName: demoUser.fullName,
        email,
        passwordHash,
        status: AccountStatus.ACTIVE,
      },
    });

    // Assign global role
    const role = await prisma.role.findUnique({ where: { code: demoUser.globalRoleCode } });
    if (role) {
      const existingAssignment = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id, revokedAt: null },
      });
      if (!existingAssignment) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
    }

    userRecords.push({ id: user.id, email, eventRoleCode: demoUser.eventRoleCode });
    console.log(`Seeded demo user: ${email} with role ${demoUser.globalRoleCode}`);
  }

  // Create a demo event
  const demoEvent = await prisma.event.upsert({
    where: { slug: "demo-event-2026" },
    update: {
      title: "Demo Event 2026",
      description:
        "A demonstration event for reviewing the event-scoped role architecture. All demo team members are assigned to this event.",
      status: EventStatus.PUBLISHED,
    },
    create: {
      title: "Demo Event 2026",
      slug: "demo-event-2026",
      description:
        "A demonstration event for reviewing the event-scoped role architecture. All demo team members are assigned to this event.",
      status: EventStatus.PUBLISHED,
      registrationOpensAt: new Date(),
      registrationClosesAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      startsAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 46 * 24 * 60 * 60 * 1000),
      capacity: 100,
    },
  });

  console.log(`Seeded demo event: ${demoEvent.title} (${demoEvent.slug})`);

  // Assign each demo user to the demo event
  for (const record of userRecords) {
    await prisma.eventTeamMember.upsert({
      where: {
        eventId_userId_roleCode: {
          eventId: demoEvent.id,
          userId: record.id,
          roleCode: record.eventRoleCode,
        },
      },
      update: {
        revokedAt: null,
        assignedAt: new Date(),
      },
      create: {
        eventId: demoEvent.id,
        userId: record.id,
        roleCode: record.eventRoleCode,
      },
    });

    console.log(`  → Assigned ${record.email} as ${record.eventRoleCode} for ${demoEvent.title}`);
  }
}

async function main() {
  await seedRoles();
  await seedAdminUser();
  await seedDemoEventTeam();

  console.log("Prisma seed completed.");
}

void main()
  .catch((error) => {
    console.error("Prisma seed failed.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
