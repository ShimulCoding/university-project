import { AccountStatus, Prisma, RoleCode } from "@prisma/client";
import { roleCatalog } from "../modules/roles/role-catalog";
import { auditService } from "../modules/audit/services/audit.service";
import { hashPassword } from "./password";
import { demoTeam, localSeedConfig } from "./local-seed-policy";

// CLI-only: caller validates local operator configuration before opening this
// shared serializable governance transaction. Existing identities are read-only.
export async function seedLocalDataset(tx: Prisma.TransactionClient, config: ReturnType<typeof localSeedConfig>, hashes: { admin?: string | undefined; demo?: string | undefined }) {
  for (const role of roleCatalog) await tx.role.upsert({ where: { code: role.code }, update: { name: role.name, description: role.description, isSystem: true }, create: { ...role, isSystem: true } });
  let adminId: string | undefined;
  if (config.admin) {
    const existing = await tx.user.findUnique({ where: { email: config.admin.email }, include: { roles: { where: { revokedAt: null }, include: { role: true } } } });
    if (existing) {
      if (existing.status !== AccountStatus.ACTIVE || !existing.roles.some((assignment) => assignment.role.code === RoleCode.SYSTEM_ADMIN)) {
        throw new Error("Existing seed identity must be an active System Admin; seed cannot promote or reactivate accounts.");
      }
      adminId = existing.id;
    } else {
      if (!hashes.admin) throw new Error("New admin hash missing.");
      // An initial seed cannot silently add another global administrator to a
      // configured installation. Use audited System Admin account management.
      if (await tx.userRole.count({ where: { revokedAt: null, role: { code: RoleCode.SYSTEM_ADMIN }, user: { status: AccountStatus.ACTIVE } } })) {
        throw new Error("An active System Admin already exists; use account management to add administrators.");
      }
      const admin = await tx.user.create({ data: {
        fullName: config.admin.fullName, email: config.admin.email, passwordHash: hashes.admin,
        roles: { create: { role: { connect: { code: RoleCode.SYSTEM_ADMIN } } } },
      } });
      adminId = admin.id;
      await auditService.record({ actorId: admin.id, action: "seed.initial_admin_created", entityType: "User", entityId: admin.id, summary: "Local operator created the initial administrator." }, tx);
    }
  }
  if (config.demoPassword) {
    if (!adminId || !hashes.demo) throw new Error("Demo setup requires an active configured System Admin.");
    const [accounts, event] = await Promise.all([
      tx.user.count({ where: { email: { in: demoTeam.map((member) => member.email) } } }),
      tx.event.findUnique({ where: { slug: "demo-event-2026" }, select: { id: true } }),
    ]);
    if (accounts || event) throw new Error("Demo identities or event already exist; seed preserves them and their assignments.");
    const createdEvent = await tx.event.create({ data: { title: "Demo Event 2026", slug: "demo-event-2026", description: "Local demonstration of event-specific team permissions.", status: "DRAFT", capacity: 100, createdById: adminId,
      registrationOpensAt: new Date(), registrationClosesAt: new Date(Date.now() + 30 * 86400000), startsAt: new Date(Date.now() + 45 * 86400000), endsAt: new Date(Date.now() + 46 * 86400000) } });
    for (const member of demoTeam) {
      const user = await tx.user.create({ data: { fullName: member.fullName, email: member.email, passwordHash: hashes.demo } });
      await tx.eventTeamMember.create({ data: { eventId: createdEvent.id, userId: user.id, roleCode: member.roleCode, assignedById: adminId } });
    }
    await tx.event.update({ where: { id: createdEvent.id }, data: { status: "PUBLISHED" } });
    await auditService.record({ actorId: adminId, eventId: createdEvent.id, action: "seed.demo_team_created", entityType: "Event", entityId: createdEvent.id, summary: "Local operator created a new demonstration event and four separate team accounts." }, tx);
  }
  return { adminConfigured: Boolean(adminId), demoCreated: Boolean(config.demoPassword) };
}

export async function seedPasswordHashes(config: ReturnType<typeof localSeedConfig>) {
  return { admin: config.admin ? await hashPassword(config.admin.password) : undefined, demo: config.demoPassword ? await hashPassword(config.demoPassword) : undefined };
}

export async function assertFreshDemoDataset(db: Pick<Prisma.TransactionClient, "user" | "event">, emails: string[], slugs: string[]) {
  const [accounts, events] = await Promise.all([
    db.user.count({ where: { email: { in: emails } } }),
    db.event.count({ where: { slug: { in: slugs } } }),
  ]);
  if (accounts || events) throw new Error("Demo dataset already exists. Existing accounts, event data and revoked assignments are preserved.");
}

export async function createSeedAccount(tx: Prisma.TransactionClient, input: { fullName: string; email: string; studentId?: string | undefined; roles: RoleCode[] }, passwordHash: string, adminId: string) {
  if (input.roles.includes(RoleCode.SYSTEM_ADMIN)) throw new Error("Demo setup cannot create global administrators.");
  const user = await tx.user.create({ data: { fullName: input.fullName, email: input.email.trim().toLowerCase(), passwordHash, ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.roles.includes(RoleCode.GENERAL_STUDENT) ? { roles: { create: { role: { connect: { code: RoleCode.GENERAL_STUDENT } }, assignedBy: { connect: { id: adminId } } } } } : {}) } });
  await auditService.record({ actorId: adminId, action: "seed.demo_account_created", entityType: "User", entityId: user.id, summary: "Local operator created a new demonstration account." }, tx);
  return user;
}
