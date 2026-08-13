import bcrypt from "bcryptjs";
import {
  AccountStatus,
  EventStatus,
  PrismaClient,
  RegistrationPaymentState,
  RoleCode,
} from "@prisma/client";

import { roleCatalog } from "../src/modules/roles/role-catalog";
import { normalizeEmail } from "../src/utils/normalize-email";

const prisma = new PrismaClient();

async function ensureRoleCatalog() {
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

async function ensureUser(input: {
  fullName: string;
  email: string;
  password: string;
  roles: RoleCode[];
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      fullName: input.fullName,
      passwordHash,
      status: AccountStatus.ACTIVE,
    },
    create: {
      fullName: input.fullName,
      email: normalizedEmail,
      passwordHash,
      status: AccountStatus.ACTIVE,
    },
  });

  const globalRoleCodes = input.roles.filter(
    (roleCode) => roleCode === RoleCode.SYSTEM_ADMIN || roleCode === RoleCode.GENERAL_STUDENT,
  );
  const operationalRoles = await prisma.role.findMany({
    where: {
      code: {
        in: [
          RoleCode.EVENT_ADMIN,
          RoleCode.FINANCIAL_CONTROLLER,
          RoleCode.ORGANIZATIONAL_APPROVER,
          RoleCode.EVENT_MANAGEMENT_USER,
          RoleCode.COMPLAINT_REVIEW_AUTHORITY,
        ],
      },
    },
  });

  await prisma.userRole.updateMany({
    where: {
      userId: user.id,
      roleId: { in: operationalRoles.map((role) => role.id) },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  for (const roleCode of globalRoleCodes) {
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
    });

    if (!role) {
      throw new Error(`Role ${roleCode} was not found during demo seeding.`);
    }

    const existingAssignment = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
        revokedAt: null,
      },
    });

    if (!existingAssignment) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }
  }

  return user;
}

async function requireSystemAdmin() {
  const systemAdmin = await prisma.user.findFirst({
    where: {
      status: AccountStatus.ACTIVE,
      roles: {
        some: {
          revokedAt: null,
          role: { code: RoleCode.SYSTEM_ADMIN },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!systemAdmin) {
    throw new Error(
      "An active SYSTEM_ADMIN must be seeded before demo flow data. Run the Prisma seed first.",
    );
  }

  return systemAdmin;
}

async function ensureEventTeamMember(eventId: string, userId: string, roleCode: RoleCode) {
  return prisma.eventTeamMember.upsert({
    where: {
      eventId_userId_roleCode: { eventId, userId, roleCode },
    },
    update: { assignedAt: new Date(), revokedAt: null },
    create: { eventId, userId, roleCode },
  });
}

async function ensureDemoEvent(createdById: string) {
  return prisma.event.upsert({
    where: {
      slug: "demo-finance-transparency-workshop",
    },
    update: {
      title: "Demo Finance Transparency Workshop",
      description: "Demo event for verifying registration, payment proof, and manual income flow.",
      status: EventStatus.PUBLISHED,
      registrationOpensAt: new Date("2026-01-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-12-31T23:59:59.000Z"),
      startsAt: new Date("2026-11-20T09:00:00.000Z"),
      endsAt: new Date("2026-11-20T17:00:00.000Z"),
      capacity: 200,
      createdById,
    },
    create: {
      title: "Demo Finance Transparency Workshop",
      slug: "demo-finance-transparency-workshop",
      description: "Demo event for verifying registration, payment proof, and manual income flow.",
      status: EventStatus.PUBLISHED,
      registrationOpensAt: new Date("2026-01-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-12-31T23:59:59.000Z"),
      startsAt: new Date("2026-11-20T09:00:00.000Z"),
      endsAt: new Date("2026-11-20T17:00:00.000Z"),
      capacity: 200,
      createdById,
    },
  });
}

async function ensureDemoRegistration(eventId: string, participantId: string, participantEmail: string, participantName: string) {
  return prisma.registration.upsert({
    where: {
      eventId_studentId: {
        eventId,
        studentId: "DEMO-STU-001",
      },
    },
    update: {
      participantId,
      participantName,
      email: participantEmail,
      paymentState: RegistrationPaymentState.PENDING_VERIFICATION,
    },
    create: {
      eventId,
      participantId,
      participantName,
      studentId: "DEMO-STU-001",
      email: participantEmail,
      phone: "8801000000000",
      registrationCode: "DEMO-REG-001",
      paymentState: RegistrationPaymentState.PENDING_VERIFICATION,
    },
  });
}

async function ensurePendingPaymentProof(registrationId: string) {
  const existingProof = await prisma.paymentProof.findFirst({
    where: {
      registrationId,
      transactionReference: "DEMO-TXN-001",
    },
  });

  if (existingProof) {
    return existingProof;
  }

  return prisma.paymentProof.create({
    data: {
      registrationId,
      externalChannel: "bKash",
      transactionReference: "DEMO-TXN-001",
      referenceText: "Demo external payment proof for verification queue testing.",
      amount: "500.00",
    },
  });
}

async function ensureManualIncome(eventId: string, recordedById: string) {
  const existingIncome = await prisma.incomeRecord.findFirst({
    where: {
      eventId,
      sourceLabel: "Demo Sponsor Contribution",
    },
  });

  if (existingIncome) {
    return existingIncome;
  }

  return prisma.incomeRecord.create({
    data: {
      eventId,
      sourceType: "SPONSOR",
      sourceLabel: "Demo Sponsor Contribution",
      amount: "2500.00",
      referenceText: "Demo sponsor pledge reference for manual income testing.",
      collectedAt: new Date("2026-10-15T10:00:00.000Z"),
      recordedById,
    },
  });
}

async function main() {
  await ensureRoleCatalog();
  const demoSystemAdmin = await requireSystemAdmin();

  const demoManager = await ensureUser({
    fullName: "Demo Event Manager",
    email: "demo.event.manager@example.com",
    password: "DemoPass123!",
    roles: [RoleCode.EVENT_MANAGEMENT_USER],
  });

  const demoFinance = await ensureUser({
    fullName: "Demo Finance Controller",
    email: "demo.finance@example.com",
    password: "DemoPass123!",
    roles: [RoleCode.FINANCIAL_CONTROLLER],
  });

  const demoEventAdmin = await ensureUser({
    fullName: "Demo Event Admin",
    email: "demo.event.admin@example.com",
    password: "DemoPass123!",
    roles: [RoleCode.EVENT_ADMIN],
  });

  const demoApprover = await ensureUser({
    fullName: "Demo Organizational Approver",
    email: "demo.approver@example.com",
    password: "DemoPass123!",
    roles: [RoleCode.ORGANIZATIONAL_APPROVER],
  });

  const demoStudent = await ensureUser({
    fullName: "Demo Student",
    email: "demo.student@example.com",
    password: "DemoPass123!",
    roles: [RoleCode.GENERAL_STUDENT],
  });

  const demoEvent = await ensureDemoEvent(demoSystemAdmin.id);
  await Promise.all([
    ensureEventTeamMember(demoEvent.id, demoEventAdmin.id, RoleCode.EVENT_ADMIN),
    ensureEventTeamMember(demoEvent.id, demoManager.id, RoleCode.EVENT_MANAGEMENT_USER),
    ensureEventTeamMember(demoEvent.id, demoFinance.id, RoleCode.FINANCIAL_CONTROLLER),
    ensureEventTeamMember(demoEvent.id, demoApprover.id, RoleCode.ORGANIZATIONAL_APPROVER),
  ]);
  const demoRegistration = await ensureDemoRegistration(
    demoEvent.id,
    demoStudent.id,
    demoStudent.email,
    demoStudent.fullName,
  );
  const demoPaymentProof = await ensurePendingPaymentProof(demoRegistration.id);
  const demoIncome = await ensureManualIncome(demoEvent.id, demoFinance.id);

  console.log("Demo flow seed is ready.");
  console.log(`Event: ${demoEvent.slug}`);
  console.log(`Registration: ${demoRegistration.registrationCode}`);
  console.log(`Payment proof: ${demoPaymentProof.id}`);
  console.log(`Income record: ${demoIncome.id}`);
}

void main()
  .catch((error) => {
    console.error("Demo flow seed failed.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
