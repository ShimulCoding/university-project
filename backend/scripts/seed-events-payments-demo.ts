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

  for (const roleCode of input.roles) {
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

  const demoStudent = await ensureUser({
    fullName: "Demo Student",
    email: "demo.student@example.com",
    password: "DemoPass123!",
    roles: [RoleCode.GENERAL_STUDENT],
  });

  const demoEvent = await ensureDemoEvent(demoManager.id);
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
