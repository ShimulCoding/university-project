import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { AccountStatus, EventStatus, RoleCode, type User } from "@prisma/client";

import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { fixturePrisma, verifyFixtureDatabase, disconnectFixtureDatabase, fixtureFailureDiagnostics } from "./helpers/fixture-database";
import { documentDirectories, resolveUploadPath, uploadRules } from "../src/config/uploads";
import { storageProvider } from "../src/storage";
import { storeValidatedUploads } from "../src/utils/upload-utils";
import { signAccessToken, signRefreshToken } from "../src/utils/tokens";
import { hashValue } from "../src/utils/hash";
import { hashPassword } from "../src/utils/password";
import type { AuthenticatedUser } from "../src/types/auth";
import { registrationsService } from "../src/modules/registrations/services/registrations.service";
import { paymentsService } from "../src/modules/payments/services/payments.service";
import { budgetsService } from "../src/modules/budgets/services/budgets.service";
import { requestsService } from "../src/modules/requests/services/requests.service";
import { complaintsService } from "../src/modules/complaints/services/complaints.service";
import { reconciliationService } from "../src/modules/reconciliation/services/reconciliation.service";
import { publicService } from "../src/modules/public/services/public.service";
import { authService } from "../src/modules/auth/services/auth.service";
import { auditService } from "../src/modules/audit/services/audit.service";
import { mailer } from "../src/config/mailer";
import { moneyField } from "../src/utils/money-validation";
import { passwordField } from "../src/utils/password-validation";
import { approvalsService } from "../src/modules/approvals/services/approvals.service";
import { documentsService } from "../src/modules/documents/services/documents.service";
import { usersRepository } from "../src/modules/users/repositories/users.repository";

const run = randomUUID();
const users: string[] = [], events: string[] = [];
let checks = 0;
function check(value: unknown, message: string) { assert(value, message); checks++; }
async function conflict(action: () => Promise<unknown>) {
  await assert.rejects(action, (e: { statusCode?: number }) => e.statusCode === 409); checks++;
}
function file(text = "%PDF-1.4\n%%EOF\n"): Express.Multer.File {
  const buffer = Buffer.from(text);
  return { buffer, size: buffer.length, originalname: "evidence.exe", mimetype: "application/pdf", fieldname: "files", encoding: "7bit" } as Express.Multer.File;
}
async function main() {
  await verifyFixtureDatabase();
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const actorRoles = [RoleCode.GENERAL_STUDENT, RoleCode.GENERAL_STUDENT, RoleCode.EVENT_MANAGEMENT_USER, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_ADMIN];
  try {
    const passwordHash = await hashPassword(`Audit-${run}!`);
    const accounts: User[] = [];
    for (const [i, role] of actorRoles.entries()) {
      const user = await prisma.user.create({ data: { fullName: `Audit ${i}`, email: `audit-${i}-${run}@example.com`, studentId: `A${run.slice(0, 20)}-${i}`, passwordHash } });
      users.push(user.id); accounts.push(user);
    }
    const event = await prisma.event.create({ data: { title: `Audit ${run}`, slug: `audit-${run}`, status: EventStatus.PUBLISHED, capacity: 1 } });
    events.push(event.id);
    for (let i = 2; i < accounts.length; i++) await prisma.eventTeamMember.create({ data: { eventId: event.id, userId: accounts[i]!.id, roleCode: actorRoles[i]! } });
    const actors = accounts.map((u, i): AuthenticatedUser => ({ id: u.id, fullName: u.fullName, email: u.email, status: AccountStatus.ACTIVE, roles: [], eventRoles: i < 2 ? [] : [{ eventId: event.id, roleCode: actorRoles[i]! }] }));
    const manager = actors[2]!, finance = actors[3]!, approver = actors[4]!, reviewer = actors[5]!;

    for (let round = 0; round < 3; round++) {
      const sessions = await Promise.allSettled(accounts.map((account) => authService.login({ studentId: account.studentId!, password: `Audit-${run}!` })));
      check(sessions.every((session) => session.status === "fulfilled"), "Independent concurrent logins exhausted transaction retries");
    }
    const signups = await Promise.allSettled(Array.from({ length: 4 }, (_, index) => authService.register({
      fullName: `Audit signup ${index}`, email: `audit-signup-${index}-${run}@example.com`, password: `Audit-${run}!`,
      studentId: `S${run.slice(0, 18)}-${index}`, batch: "2026", department: "CSE", section: "A",
    }).then((session) => { users.push(session.user.id); return session; })));
    check(signups.every((signup) => signup.status === "fulfilled"), "Independent concurrent student signups exhausted transaction retries");
    const duplicateStudentId = `D${run.slice(0, 18)}`;
    const duplicates = await Promise.allSettled([0, 1].map((index) => authService.register({
      fullName: "Audit duplicate student", email: `audit-duplicate-${index}-${run}@example.com`, password: `Audit-${run}!`,
      studentId: duplicateStudentId, batch: "2026", department: "CSE", section: "A",
    }).then((session) => { users.push(session.user.id); return session; })));
    check(duplicates.filter((signup) => signup.status === "fulfilled").length === 1, "Concurrent signup duplicated a Student ID");
    check(await prisma.user.count({ where: { studentId: duplicateStudentId } }) === 1, "Student ID uniqueness failed in the database");

    const account = accounts[5]!;
    const sessionsBeforeRace = await prisma.refreshToken.count({ where: { userId: account.id } });
    const loadUser = usersRepository.findById;
    usersRepository.findById = async (id, db) => {
      const user = await loadUser(id, db);
      return user && id === account.id ? { ...user, passwordHash: "changed-during-verification" } : user;
    };
    try {
      await assert.rejects(() => authService.login({ studentId: account.studentId!, password: `Audit-${run}!` }), (error: { statusCode?: number }) => error.statusCode === 401);
      checks++;
    } finally { usersRepository.findById = loadUser; }
    check(await prisma.refreshToken.count({ where: { userId: account.id } }) === sessionsBeforeRace, "Changed credentials still created a session");

    let deactivateOnce = true;
    usersRepository.findById = async (id, db) => {
      const user = await loadUser(id, db);
      if (id === account.id && db && db !== prisma && deactivateOnce) {
        deactivateOnce = false;
        await prisma.user.update({ where: { id }, data: { status: "INACTIVE", sessionVersion: { increment: 1 } } });
      }
      return user;
    };
    try {
      await assert.rejects(() => authService.login({ studentId: account.studentId!, password: `Audit-${run}!` }), (error: { statusCode?: number }) => error.statusCode === 403);
      checks++;
    } finally {
      usersRepository.findById = loadUser;
      await prisma.user.update({ where: { id: account.id }, data: { status: "ACTIVE" } });
    }
    check(await prisma.refreshToken.count({ where: { userId: account.id } }) === sessionsBeforeRace, "Concurrent deactivation still created a session");

    const capacity = await Promise.allSettled(actors.slice(0, 2).map((a, i) => registrationsService.createRegistration(a, { eventId: event.id, studentId: accounts[i]!.studentId! })));
    check(capacity.filter((r) => r.status === "fulfilled").length === 1, "Concurrent registrations exceeded capacity");
    check(await prisma.registration.count({ where: { eventId: event.id } }) === 1, "Capacity database invariant failed");
    const registration = await prisma.registration.findFirstOrThrow({ where: { eventId: event.id } });
    await prisma.event.update({ where: { id: event.id }, data: { capacity: 100 } });
    const owner = actors.find((a) => a.id === registration.participantId)!;
    await conflict(() => registrationsService.createRegistration(owner, { eventId: event.id, studentId: `changed-${run}` }));
    const otherStudent = actors.slice(0, 2).find((actor) => actor.id !== owner.id)!;
    await assert.rejects(() => registrationsService.createRegistration(otherStudent, { eventId: event.id, studentId: registration.studentId }), (error: { statusCode?: number }) => error.statusCode === 400); checks++;

    const submissions = await Promise.allSettled([1, 2].map(() => paymentsService.submitPaymentProof(owner, registration.id, { externalChannel: "Cash", referenceText: "Audit evidence", amount: "10.00" }, [])));
    check(submissions.filter((r) => r.status === "fulfilled").length === 1, "Duplicate pending payment proofs created");
    const proof = await prisma.paymentProof.findFirstOrThrow({ where: { registrationId: registration.id } });
    const decisions = await Promise.allSettled(["APPROVE", "REJECT"].map((decision) => paymentsService.decidePaymentProof(finance, proof.id, { decision: decision as "APPROVE" | "REJECT", remark: "Audit decision" })));
    check(decisions.filter((r) => r.status === "fulfilled").length === 1, "Concurrent payment decisions both succeeded");
    check(await prisma.auditLog.count({ where: { entityId: proof.id, action: "payments.proof.review" } }) === 1, "Payment audit was duplicated");

    const income = await paymentsService.createIncomeRecord(finance, { eventId: event.id, amount: "20.00", sourceType: "DONATION", sourceLabel: "Audit donation", referenceText: "Evidence note" }, [], randomUUID());
    await Promise.allSettled([paymentsService.voidIncomeRecord(finance, income.id, { reason: "Audit void" }), paymentsService.verifyIncomeRecord(finance, income.id)]);
    check((await prisma.incomeRecord.findUniqueOrThrow({ where: { id: income.id } })).state === "REJECTED", "A concurrent verify resurrected a voided income");
    await conflict(() => paymentsService.verifyIncomeRecord(finance, income.id));
    await conflict(() => paymentsService.voidIncomeRecord(finance, income.id, { reason: "Repeated void" }));

    const budget = await budgetsService.createBudget(manager, { eventId: event.id, items: [{ category: "Operations", label: "Audit item", amount: "10.00" }], submit: true });
    const approvals = await Promise.allSettled([1, 2].map(() => budgetsService.updateBudgetState(approver, budget.id, { state: "APPROVED" })));
    check(approvals.filter((r) => r.status === "fulfilled").length === 1, "Budget approval was overwritten");
    check(await prisma.budget.count({ where: { eventId: event.id, isActive: true } }) === 1, "Active budget invariant failed");

    const expenseRequest = await prisma.expenseRequest.create({ data: { eventId: event.id, requestedById: manager.id, amount: "10.00", category: "Operations", purpose: "Audit expense", state: "APPROVED" } });
    const expense = await requestsService.createExpenseRecord(finance, { eventId: event.id, expenseRequestId: expenseRequest.id, amount: "10.00", category: "Operations", description: "Audit expense" }, [], randomUUID());
    await Promise.allSettled([requestsService.voidExpenseRecord(finance, expense.id, { reason: "Audit void" }), requestsService.settleExpenseRecord(finance, expense.id, {})]);
    check((await prisma.expenseRecord.findUniqueOrThrow({ where: { id: expense.id } })).state === "VOIDED", "Concurrent settlement resurrected a voided expense");

    const complaint = await complaintsService.createComplaint(owner, { eventId: event.id, subject: "Audit complaint", description: "Complaint concurrency verification fixture." }, []);
    const reviews = await Promise.allSettled([1, 2].map(() => complaintsService.startReview(reviewer, complaint.id, { note: "Audit review" })));
    check(reviews.filter((r) => r.status === "fulfilled").length === 1, "Concurrent complaint transitions duplicated history");

    await prisma.event.update({ where: { id: event.id }, data: { status: "COMPLETED" } });
    const report = await reconciliationService.generateReport(finance, { eventId: event.id });
    await reconciliationService.reviewReport(finance, report.id);
    await reconciliationService.finalizeReport(approver, report.id);
    const publications = await Promise.all([1, 2].map(() => publicService.publishFinancialSummary(approver, report.id)));
    check(publications[0]!.id === publications[1]!.id, "Concurrent publication created duplicate snapshots");
    await reconciliationService.generateReport(finance, { eventId: event.id });
    await conflict(() => publicService.publishFinancialSummary(approver, report.id));
    const currentReport = await reconciliationService.generateReport(finance, { eventId: event.id });
    const unverified = await paymentsService.createIncomeRecord(finance, { eventId: event.id, amount: "1.00", sourceType: "DONATION", sourceLabel: "Warning freshness", referenceText: "Unverified fixture" }, [], randomUUID());
    check((await prisma.reconciliationReport.findUniqueOrThrow({ where: { id: currentReport.id } })).isStale, "Unverified income left reconciliation warnings current");
    const beforeVoid = await reconciliationService.generateReport(finance, { eventId: event.id });
    await paymentsService.voidIncomeRecord(finance, unverified.id, { reason: "Warning removal" });
    check((await prisma.reconciliationReport.findUniqueOrThrow({ where: { id: beforeVoid.id } })).isStale, "Voiding unverified income left reconciliation warnings current");

    const queueDate = new Date();
    await prisma.budgetRequest.createMany({ data: Array.from({ length: 12 }, (_, index) => ({ id: `queue-budget-${run}-${index}`, eventId: event.id, requestedById: manager.id, amount: "1.00", purpose: "Queue pagination", state: "SUBMITTED", createdAt: queueDate })) });
    await prisma.expenseRequest.createMany({ data: Array.from({ length: 12 }, (_, index) => ({ id: `queue-expense-${run}-${index}`, eventId: event.id, requestedById: manager.id, amount: "1.00", category: "Operations", purpose: "Queue pagination", state: "SUBMITTED", createdAt: queueDate })) });
    const firstPage = await approvalsService.listApprovalQueue(approver, { eventId: event.id, page: 1, pageSize: 20 });
    const secondPage = await approvalsService.listApprovalQueue(approver, { eventId: event.id, page: 2, pageSize: 20 });
    check(firstPage.pagination.totalItems === 24 && secondPage.queue.length === 4, "Approval queue pagination/count failed");
    check(new Set([...firstPage.queue, ...secondPage.queue].map((item) => item.entityId)).size === 24, "Tied timestamps duplicated approval rows across pages");
    const budgetsOnly = await approvalsService.listApprovalQueue(approver, { eventId: event.id, entityType: "BUDGET_REQUEST" });
    check(budgetsOnly.pagination.totalItems === 12 && budgetsOnly.queue.every((item) => item.entityType === "BUDGET_REQUEST"), "Approval entity-type filter failed");

    const retained = await requestsService.createExpenseRequest(manager, { eventId: event.id, amount: "1.00", category: "Operations", purpose: "Retained evidence", submit: false }, [file()]);
    const revised = await requestsService.updateExpenseRequest(manager, retained.id, { purpose: "Revised purpose" }, [file()]);
    check(revised.documents.length === 2 && revised.documents.some((document) => document.id === retained.documents[0]!.id), "Request revision discarded original evidence");
    for (const document of revised.documents) {
      const stored = await prisma.supportingDocument.findUniqueOrThrow({ where: { id: document.id } });
      check(stored.relativePath.endsWith(".pdf"), "Untrusted original extension was persisted");
      await documentsService.getProtectedDocument(manager, document.id);
      checks++;
      await fs.writeFile(resolveUploadPath(stored.relativePath), Buffer.alloc(0));
      await assert.rejects(() => documentsService.getProtectedDocument(manager, document.id), (error: { statusCode?: number }) => error.statusCode === 404);
      checks++;
      await storageProvider.removeFile(stored.relativePath);
      await assert.rejects(() => documentsService.getProtectedDocument(manager, document.id), (error: { statusCode?: number }) => error.statusCode === 404);
      checks++;
    }

    const record = auditService.record;
    const before = await prisma.incomeRecord.count({ where: { eventId: event.id } });
    auditService.record = async () => { throw new Error("Injected audit failure"); };
    try {
      await assert.rejects(() => paymentsService.createIncomeRecord(finance, { eventId: event.id, amount: "1.00", sourceType: "DONATION", sourceLabel: "Rollback fixture", referenceText: "Audit rollback" }, [], randomUUID()));
    } finally { auditService.record = record; }
    check(await prisma.incomeRecord.count({ where: { eventId: event.id } }) === before, "Audit failure left a committed income record");

    check(!moneyField.safeParse("10000000000.00").success, "Oversized money reached the database");
    check(!moneyField.safeParse("1.001").success, "Fractional cents accepted");
    check(!moneyField.safeParse("0").success, "Zero income accepted");
    check(!passwordField.safeParse("😀".repeat(20)).success, "bcrypt silently truncated a multi-byte password");
    assert.throws(() => resolveUploadPath("../outside.pdf")); checks++;
    const options = { category: "SUPPORTING_DOCUMENT" as const, destinationDir: documentDirectories.SUPPORTING_DOCUMENT, rule: uploadRules.SUPPORTING_DOCUMENT };
    let saved = 0, removed = 0;
    const save = storageProvider.saveFile, remove = storageProvider.removeFile;
    storageProvider.saveFile = async () => { saved++; if (saved === 2) throw new Error("Injected storage failure"); return { storedName: "test.pdf", absolutePath: "test.pdf", relativePath: "supporting-documents/test.pdf" }; };
    storageProvider.removeFile = async () => { removed++; };
    try {
      await assert.rejects(() => storeValidatedUploads([file(), file("spoofed PDF")], options));
      check(saved === 0, "Invalid batch saved files before validation completed");
      await assert.rejects(() => storeValidatedUploads([file(), file()], options));
      check(removed === 1, "Partial storage failure left an orphaned file");
    } finally { storageProvider.saveFile = save; storageProvider.removeFile = remove; }

    async function http(route: string, expected: number, init?: RequestInit) {
      const response = await fetch(base + route, init);
      check(response.status === expected, `${route}: expected ${expected}, received ${response.status}`);
      return response;
    }
    await http("/auth/logout", 204, { method: "POST", headers: { Cookie: "mu_refresh_token=invalid; mu_access_token=invalid" } });
    await http("/auth/login", 400, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    await http("/auth/login", 413, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ huge: "a".repeat(2_100_000) }) });
    await http("/events?page=9007199254740992", 400);
    await http("/events", 403, { headers: { Origin: "https://untrusted.example" } });
    const ownerAccount = accounts.find((account) => account.id === owner.id)!;
    for (let attempt = 0; attempt < 12; attempt++) {
      await http("/auth/login", 200, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: ownerAccount.studentId, password: `Audit-${run}!` }) });
    }
    const sessionsBefore = await prisma.refreshToken.count({ where: { userId: owner.id } });
    auditService.record = async () => { throw new Error("Injected login audit failure"); };
    try { await assert.rejects(() => authService.login({ studentId: ownerAccount.studentId!, password: `Audit-${run}!` })); }
    finally { auditService.record = record; }
    check(await prisma.refreshToken.count({ where: { userId: owner.id } }) === sessionsBefore, "Login audit rollback left an orphaned refresh session");

    const raw = signRefreshToken(owner.id);
    const session = await prisma.refreshToken.create({ data: { userId: owner.id, tokenHash: hashValue(raw), expiresAt: new Date(Date.now() + 60_000) } });
    const access = signAccessToken(owner.id, 0, session.id);
    await http("/auth/me", 200, { headers: { Cookie: `mu_access_token=${access}` } });
    await http("/auth/logout", 204, { method: "POST", headers: { Cookie: `mu_refresh_token=${raw}` } });
    await http("/auth/me", 401, { headers: { Cookie: `mu_access_token=${access}` } });
    const reset = `reset-${run}`, other = `other-${run}`;
    for (const token of [reset, other]) await prisma.passwordResetToken.create({ data: { userId: owner.id, tokenHash: hashValue(token), expiresAt: new Date(Date.now() + 60_000) } });
    const resetSession = await prisma.refreshToken.create({ data: { userId: owner.id, tokenHash: hashValue(`pre-reset-${run}`), expiresAt: new Date(Date.now() + 60_000) } });
    const oldAccess = signAccessToken(owner.id, 0, resetSession.id);
    await http("/auth/me", 200, { headers: { Cookie: `mu_access_token=${oldAccess}` } });
    await authService.resetPassword({ token: reset, newPassword: `New-${run}!` });
    await http("/auth/me", 401, { headers: { Cookie: `mu_access_token=${oldAccess}` } });
    check(await prisma.passwordResetToken.count({ where: { userId: owner.id, usedAt: null } }) === 0, "Password reset left another usable reset link");
    const send = mailer.sendPasswordResetEmail;
    mailer.sendPasswordResetEmail = async () => { throw new Error("Injected SMTP failure"); };
    try {
      const matching = await authService.forgotPassword({ studentId: accounts.find((a) => a.id === owner.id)!.studentId!, email: owner.email });
      const missing = await authService.forgotPassword({ studentId: "unknown", email: "unknown@example.com" });
      check(matching.message === missing.message, "SMTP failure disclosed matching recovery details");
    } finally { mailer.sendPasswordResetEmail = send; }
    const resetsBefore = await prisma.passwordResetToken.count({ where: { userId: owner.id } });
    auditService.record = async () => { throw new Error("Injected recovery audit failure"); };
    try {
      const matching = await authService.forgotPassword({ studentId: ownerAccount.studentId!, email: owner.email });
      const missing = await authService.forgotPassword({ studentId: "unknown", email: "unknown@example.com" });
      check(matching.message === missing.message, "Recovery audit failure disclosed account details");
    } finally { auditService.record = record; }
    check(await prisma.passwordResetToken.count({ where: { userId: owner.id } }) === resetsBefore, "Recovery audit failure left a reset capability committed");
    for (let index = 0; index < 21; index++) {
      const additional = await prisma.event.create({ data: { title: `Audit ${run} page ${index}`, slug: `audit-${run}-page-${index}`, status: "COMPLETED" } });
      events.push(additional.id);
      for (let revision = 0; revision < (index === 0 ? 2 : 1); revision++) {
        const snapshotReport = await prisma.reconciliationReport.create({ data: { eventId: additional.id, status: "FINALIZED", totalIncome: "9999999999999999.99", totalExpense: "0", closingBalance: "9999999999999999.99" } });
        await prisma.publicSummarySnapshot.create({ data: { eventId: additional.id, reconciliationReportId: snapshotReport.id, status: "PUBLISHED", publishedAt: new Date(Date.now() + revision), totalCollected: "9999999999999999.99", totalSpent: "0", closingBalance: "9999999999999999.99" } });
      }
    }
    const summaryFirst = await publicService.listPublishedFinancialSummaries({ search: run, latestOnly: true, page: 1, pageSize: 20 });
    const summarySecond = await publicService.listPublishedFinancialSummaries({ search: run, latestOnly: true, page: 2, pageSize: 20 });
    check(summaryFirst.pagination.totalItems === 22 && summarySecond.summaries.length === 2, "Latest-per-event summaries were paginated before deduplication");
    check(new Set([...summaryFirst.summaries, ...summarySecond.summaries].map((summary) => summary.event.id)).size === 22, "An event was duplicated across public summary pages");
    check(summaryFirst.pagination.historicalSnapshotCount === 1, "Historical public snapshot count was truncated");
    check((await publicService.listPublishedFinancialSummaries({ search: `%${run}`, latestOnly: true })).pagination.totalItems === 0, "Public search treated literal percent as a wildcard");
    const incomesBeforeRevocation = await prisma.incomeRecord.count({ where: { eventId: event.id } });
    await prisma.eventTeamMember.updateMany({ where: { eventId: event.id, userId: finance.id }, data: { revokedAt: new Date() } });
    await assert.rejects(() => paymentsService.createIncomeRecord(finance, { eventId: event.id, amount: "1.00", sourceType: "DONATION", sourceLabel: "Revoked actor", referenceText: "Must be rejected" }, [], randomUUID()), (error: { statusCode?: number }) => error.statusCode === 403); checks++;
    check(await prisma.incomeRecord.count({ where: { eventId: event.id } }) === incomesBeforeRevocation, "An actor revoked after authentication could still write");
    console.log(`Project audit regression verification passed (${checks} checks).`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
    const documents = await fixturePrisma.supportingDocument.findMany({ where: { uploadedById: { in: users } }, select: { relativePath: true } });
    for (const document of documents) await storageProvider.removeFile(document.relativePath);
    await fixturePrisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { OR: [{ eventId: { in: events } }, { actorId: { in: users } }] } });
      await tx.event.deleteMany({ where: { id: { in: events } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    });
    await prisma.$disconnect(); await disconnectFixtureDatabase();
  }
}
void main().catch((error: unknown) => { console.error(JSON.stringify(fixtureFailureDiagnostics(error))); process.exitCode = 1; });
