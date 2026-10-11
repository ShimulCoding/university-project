import bcrypt from "bcryptjs";
import {
  AccountStatus,
  EventStatus,
  RegistrationPaymentState,
  RoleCode,
} from "@prisma/client";

import { roleCatalog } from "../src/modules/roles/role-catalog";
import { prisma } from "../src/config/prisma";
import { requireDemoSeedPassword, demoTeam } from "../src/utils/local-seed-policy";
import { assertFreshDemoDataset, createSeedAccount } from "../src/utils/local-seed";
import { governanceTransaction } from "../src/utils/governance-transaction";
import { auditService } from "../src/modules/audit/services/audit.service";

let seedAdministratorId: string;

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

async function ensureUser(input: { fullName: string; email: string; password: string; roles: RoleCode[] }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return governanceTransaction((tx) => createSeedAccount(tx, input, passwordHash, seedAdministratorId), { id: seedAdministratorId, roles: [RoleCode.SYSTEM_ADMIN], eventRoles: [] });
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
  return governanceTransaction(async (tx) => {
    const member = await tx.eventTeamMember.create({ data: { eventId, userId, roleCode, assignedById: seedAdministratorId } });
    await auditService.record({ actorId: seedAdministratorId, eventId, action: "seed.demo_team_assignment", entityType: "EventTeamMember", entityId: member.id, summary: "Local operator assigned a new demo account to its new event." }, tx);
    return member;
  }, { id: seedAdministratorId, roles: [RoleCode.SYSTEM_ADMIN], eventRoles: [] });
}

async function ensureDemoEvent(createdById: string) {
  return prisma.event.create({
    data: {
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
  const demoPassword = requireDemoSeedPassword(process.env);
  await assertFreshDemoDataset(prisma, [...demoTeam.map((member) => member.email), "demo.student@example.com"], ["demo-finance-transparency-workshop"]);
  await ensureRoleCatalog();
  const demoSystemAdmin = await requireSystemAdmin();
  seedAdministratorId = demoSystemAdmin.id;

  const demoManager = await ensureUser({
    fullName: "Demo Event Manager",
    email: "demo.event.manager@example.com",
    password: demoPassword,
    roles: [RoleCode.EVENT_MANAGEMENT_USER],
  });

  const demoFinance = await ensureUser({
    fullName: "Demo Finance Controller",
    email: "demo.finance@example.com",
    password: demoPassword,
    roles: [RoleCode.FINANCIAL_CONTROLLER],
  });

  const demoEventAdmin = await ensureUser({
    fullName: "Demo Event Admin",
    email: "demo.event.admin@example.com",
    password: demoPassword,
    roles: [RoleCode.EVENT_ADMIN],
  });

  const demoApprover = await ensureUser({
    fullName: "Demo Organizational Approver",
    email: "demo.approver@example.com",
    password: demoPassword,
    roles: [RoleCode.ORGANIZATIONAL_APPROVER],
  });

  const demoStudent = await ensureUser({
    fullName: "Demo Student",
    email: "demo.student@example.com",
    password: demoPassword,
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
  .catch(() => {
    console.error("Demo flow seed refused or failed; check local opt-in, private password and a new dataset. Private details suppressed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
