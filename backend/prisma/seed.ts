import { AccountStatus, PrismaClient, RoleCode } from "@prisma/client";
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

async function main() {
  await seedRoles();
  await seedAdminUser();

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
