import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { AccountStatus, DocumentCategory, EventStatus, RoleCode } from "@prisma/client";

import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { uploadsRoot } from "../src/config/uploads";
import { hashPassword } from "../src/utils/password";
import { storageProvider } from "../src/storage";

// Uses uniquely named fixtures and deletes only IDs created by this run.
// No seed account, existing event, or existing document is modified.
const runId = randomUUID();
const password = `Verify-${randomUUID()}!`;
const userIds: string[] = [];
const eventIds: string[] = [];
const platformComplaintIds: string[] = [];
let evidencePath: string | undefined;
let baseUrl = "";
let checks = 0;

function cookiesFrom(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

async function request(route: string, cookie = "", method = "GET", body?: unknown, expected = 200) {
  const response = await fetch(`${baseUrl}/api${route}`, {
    method,
    headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, expected, `${method} ${route} returned ${response.status}, expected ${expected}: ${await response.clone().text()}`);
  checks += 1;
  return { response, data: response.status === 204 ? null : await response.json() };
}

async function createAccount(label: string, passwordHash: string, systemAdmin = false) {
  const adminRole = systemAdmin ? await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.SYSTEM_ADMIN } }) : null;
  const user = await prisma.user.create({ data: {
    fullName: `Scope verification ${label}`,
    email: `verify-${label}-${runId}@example.com`,
    passwordHash,
    ...(adminRole ? { roles: { create: { roleId: adminRole.id } } } : {}),
  } });
  userIds.push(user.id);
  return user;
}

async function main() {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const passwordHash = await hashPassword(password);
    const admin = await createAccount("system", passwordHash, true);
    const roles = [RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER];
    const teamA = await Promise.all(roles.map((role) => createAccount(`a-${role.toLowerCase()}`, passwordHash)));
    const teamB = await Promise.all(roles.map((role) => createAccount(`b-${role.toLowerCase()}`, passwordHash)));
    const login = await request("/auth/internal-login", "", "POST", { email: admin.email, password });
    const adminCookie = cookiesFrom(login.response);

    async function createEvent(label: string, team: typeof teamA, status: EventStatus) {
      const { data } = await request("/events", adminCookie, "POST", {
        title: `Scope verification ${label} ${runId}`,
        status,
        teamMembers: roles.map((roleCode, index) => ({ roleCode, email: team[index]!.email })),
      }, 201);
      eventIds.push(data.event.id);
      return data.event as { id: string; slug: string; teamMembers: Array<{ id: string; roleCode: RoleCode; user: { id: string } }> };
    }
    const eventA = await createEvent("A", teamA, EventStatus.DRAFT);
    const eventB = await createEvent("B", teamB, EventStatus.PUBLISHED);
    const financeA = teamA[2]!;
    const approverA = teamA[3]!;
    const managerA = teamA[1]!;

    async function loginTeam(email: string, event: typeof eventA) {
      const { response } = await request("/auth/event-team-login", "", "POST", { email, password, eventLookupKey: event.slug });
      return cookiesFrom(response);
    }
    const financeCookie = await loginTeam(financeA.email, eventA);
    const approverCookie = await loginTeam(approverA.email, eventA);
    const managerCookie = await loginTeam(managerA.email, eventA);
    await request("/auth/internal-login", "", "POST", { email: financeA.email, password }, 403);
    await request("/auth/event-team-login", "", "POST", { email: financeA.email, password, eventLookupKey: eventB.slug }, 403);
    await request("/auth/event-team-login", "", "POST", { email: admin.email, password, eventLookupKey: eventA.slug }, 403);
    await request(`/events/${eventA.slug}`, managerCookie, "PATCH", { status: "PUBLISHED" }, 403);

    // A disabled required member cannot be counted as publication-ready.
    await prisma.user.update({ where: { id: financeA.id }, data: { status: AccountStatus.INACTIVE } });
    await request(`/events/${eventA.slug}`, adminCookie, "PATCH", { status: "PUBLISHED" }, 409);
    await prisma.user.update({ where: { id: financeA.id }, data: { status: AccountStatus.ACTIVE } });
    await request(`/events/${eventA.slug}`, adminCookie, "PATCH", { status: "PUBLISHED" });
    await request(`/events/${eventA.slug}`, adminCookie, "PATCH", { status: "COMPLETED" }, 403);

    async function records(event: typeof eventA, team: typeof teamA) {
      const budget = await prisma.budget.create({ data: { eventId: event.id, version: 1, title: "Scope budget", createdById: team[1]!.id } });
      const funding = await prisma.budgetRequest.create({ data: { eventId: event.id, requestedById: team[1]!.id, amount: 50, purpose: "Scope funding request", state: "SUBMITTED" } });
      const expenseRequest = await prisma.expenseRequest.create({ data: { eventId: event.id, requestedById: team[1]!.id, amount: 50, purpose: "Scope expense request", category: "Operations", state: "SUBMITTED" } });
      const expense = await prisma.expenseRecord.create({ data: { eventId: event.id, amount: 25, category: "Operations", description: "Scope expense", recordedById: team[2]!.id } });
      const income = await prisma.incomeRecord.create({ data: { eventId: event.id, sourceType: "DONATION", sourceLabel: "Scope donation", amount: 100, recordedById: team[2]!.id } });
      const complaint = await prisma.complaint.create({ data: { eventId: event.id, subject: "Scope complaint", description: "Verification fixture for protected complaint isolation." } });
      const report = await prisma.reconciliationReport.create({ data: { eventId: event.id } });
      const registration = await prisma.registration.create({ data: { eventId: event.id, participantName: "Scope participant", studentId: `verify-${event.id}`, email: `participant-${event.id}@example.com`, registrationCode: `VERIFY-${event.id}` } });
      const proof = await prisma.paymentProof.create({ data: { registrationId: registration.id, externalChannel: "Cash", amount: 20 } });
      return { budget, funding, expenseRequest, expense, income, complaint, report, registration, proof };
    }
    const a = await records(eventA, teamA);
    const b = await records(eventB, teamB);

    const listCases = [
      { route: "/payments/verification-queue", key: "queue", cookie: financeCookie },
      { route: "/payments/income-records", key: "incomeRecords", cookie: financeCookie },
      { route: "/budgets", key: "budgets", cookie: financeCookie },
      { route: "/requests/budget-requests", key: "budgetRequests", cookie: managerCookie },
      { route: "/requests/expense-requests", key: "expenseRequests", cookie: managerCookie },
      { route: "/requests/expense-records", key: "expenseRecords", cookie: financeCookie },
      { route: "/approvals/queue", key: "queue", cookie: approverCookie },
      { route: "/complaints/review-queue", key: "complaints", cookie: approverCookie },
      { route: "/reconciliation", key: "reports", cookie: financeCookie },
    ];
    for (const entry of listCases) {
      const { data } = await request(entry.route, entry.cookie);
      assert(data[entry.key].length > 0, `${entry.route} fixture is missing`);
      assert(data[entry.key].every((record: { event: { id: string } }) => record.event.id === eventA.id), `${entry.route} leaked an unassigned event`);
      await request(`${entry.route}?eventId=${eventB.id}`, entry.cookie, "GET", undefined, 403);
    }
    const { data: managed } = await request("/events/manage/list", financeCookie);
    assert.deepEqual(managed.events.map((event: { id: string }) => event.id), [eventA.id]);
    await request(`/events/manage/${eventB.slug}`, financeCookie, "GET", undefined, 403);

    const directCases = [
      [`/budgets/${b.budget.id}`, financeCookie],
      [`/payments/income-records/${b.income.id}`, financeCookie],
      [`/requests/budget-requests/${b.funding.id}`, managerCookie],
      [`/requests/expense-requests/${b.expenseRequest.id}`, managerCookie],
      [`/requests/expense-records/${b.expense.id}`, financeCookie],
      [`/complaints/${b.complaint.id}`, approverCookie],
      [`/reconciliation/${b.report.id}`, financeCookie],
      [`/registrations/${b.registration.id}`, financeCookie],
    ];
    for (const [route, cookie] of directCases) await request(route!, cookie!, "GET", undefined, 403);
    await request(`/payments/income-records/${b.income.id}/verify`, financeCookie, "POST", undefined, 403);
    await request(`/payments/proofs/${b.proof.id}/decision`, financeCookie, "POST", { decision: "APPROVE" }, 403);
    await request(`/approvals/BUDGET_REQUEST/${b.funding.id}/decisions`, approverCookie, "POST", { decision: "APPROVED" }, 403);
    await request(`/reconciliation/${b.report.id}/finalize`, approverCookie, "POST", undefined, 403);
    await request(`/public/manage/financial-summaries/${b.report.id}/publish`, approverCookie, "POST", undefined, 403);
    await request("/reconciliation/generate", financeCookie, "POST", { eventId: eventB.id }, 403);
    await request(`/payments/income-records/${a.income.id}/verify`, adminCookie, "POST", undefined, 403);
    await request("/roles/assignments", adminCookie, "POST", { userId: financeA.id, roleCode: "SYSTEM_ADMIN" }, 409);
    await request(`/users/${financeA.id}/status`, adminCookie, "PATCH", { status: "INACTIVE" }, 409);
    await request("/audit", financeCookie, "GET", undefined, 403);
    await request(`/events/${eventA.slug}/team-members`, managerCookie, "POST", { email: teamB[2]!.email, roleCode: "FINANCIAL_CONTROLLER" }, 403);

    // The restored funding UI uses the existing owner and approver lifecycle.
    const { data: draft } = await request("/requests/budget-requests", managerCookie, "POST", { eventId: eventA.id, amount: 40, purpose: "Scope editable funding", justification: "Verification draft", submit: false }, 201);
    assert.equal(draft.budgetRequest.state, "DRAFT");
    const fundingId = draft.budgetRequest.id;
    await request(`/requests/budget-requests/${fundingId}`, financeCookie, "PATCH", { amount: 45 }, 403);
    const edited = new FormData();
    edited.set("purpose", "Scope revised funding");
    edited.set("amount", "45");
    edited.set("justification", "Revised supporting justification");
    const editedResponse = await fetch(`${baseUrl}/api/requests/budget-requests/${fundingId}`, { method: "PATCH", headers: { Cookie: managerCookie }, body: edited });
    assert.equal(editedResponse.status, 200, "Multipart draft editing failed");
    checks += 1;
    await request(`/requests/budget-requests/${fundingId}/submit`, managerCookie, "POST");
    await request(`/approvals/BUDGET_REQUEST/${fundingId}/decisions`, approverCookie, "POST", { decision: "RETURNED", comment: "Clarify the funding purpose" });
    await request(`/requests/budget-requests/${fundingId}`, managerCookie, "PATCH", { purpose: "Scope clarified funding" });
    await request(`/requests/budget-requests/${fundingId}/submit`, managerCookie, "POST");
    await request(`/approvals/BUDGET_REQUEST/${fundingId}/decisions`, approverCookie, "POST", { decision: "APPROVED" });
    const { data: completedFunding } = await request(`/requests/budget-requests/${fundingId}`, managerCookie);
    assert.equal(completedFunding.budgetRequest.state, "APPROVED");
    assert.equal(completedFunding.budgetRequest.approvalDecisions.length, 2);

    // Only System Admin handles cases without an owning event.
    const platformComplaint = await prisma.complaint.create({ data: { subject: "Scope platform complaint", description: "General platform governance verification fixture." } });
    platformComplaintIds.push(platformComplaint.id);
    await request(`/complaints/${platformComplaint.id}/review`, approverCookie, "POST", { note: "Event reviewer must not review platform cases" }, 403);
    await request(`/complaints/${platformComplaint.id}/review`, adminCookie, "POST", { note: "System-level review" });
    await request(`/complaints/${a.complaint.id}/review`, adminCookie, "POST", { note: "Event reviewers own this case" }, 403);

    // Protected evidence is checked against its owning event, not its uploader.
    const relativePath = `supporting-documents/verify-${runId}.pdf`;
    evidencePath = path.resolve(uploadsRoot, relativePath);
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, "%PDF-1.4\nverification fixture\n");
    const document = await prisma.supportingDocument.create({ data: { category: DocumentCategory.PAYMENT_PROOF, originalName: "verification.pdf", mimeType: "application/pdf", storedName: path.basename(evidencePath), relativePath, sizeBytes: 32, paymentProofId: b.proof.id } });
    await request(`/documents/${document.id}/open`, financeCookie, "GET", undefined, 403);

    // One account can have different duties in different events.
    await request(`/events/${eventB.slug}/team-members`, adminCookie, "POST", { email: financeA.email, roleCode: "EVENT_MANAGEMENT_USER" });
    await loginTeam(financeA.email, eventB);
    await request(`/requests/budget-requests?eventId=${eventB.id}`, financeCookie);
    await request(`/payments/income-records?eventId=${eventB.id}`, financeCookie, "GET", undefined, 403);
    await request(`/payments/income-records/${b.income.id}/verify`, financeCookie, "POST", undefined, 403);

    // Optional frontend checks exercise the actual rendered Next.js layouts.
    const frontend = process.env.VERIFY_FRONTEND_BASE_URL;
    if (frontend) {
      const teamHtml = await (await fetch(`${frontend}/dashboard/events/${eventA.slug}`)).text();
      assert(teamHtml.includes("Event Team Sign In") && !teamHtml.includes("System Administrator Sign In"), "Signed-out event route rendered the wrong login");
      const systemHtml = await (await fetch(`${frontend}/dashboard`)).text();
      assert(systemHtml.includes("System Administrator Sign In") && !systemHtml.includes(password), "System login boundary failed");
      const financeHtml = await (await fetch(`${frontend}/dashboard/events/${eventA.slug}/income-records`, { headers: { Cookie: financeCookie } })).text();
      assert(financeHtml.includes("Scope donation"), "Assigned finance workspace did not render fixture data");
      const deniedHtml = await (await fetch(`${frontend}/dashboard/events/${eventB.slug}/income-records`, { headers: { Cookie: financeCookie } })).text();
      assert(deniedHtml.includes("Access restricted"), "An event manager saw finance data in the second event");
      const fundingHtml = await (await fetch(`${frontend}/dashboard/events/${eventA.slug}/funding-requests`, { headers: { Cookie: managerCookie } })).text();
      assert(fundingHtml.includes("Scope funding request") && fundingHtml.includes("Create budget request"), "Funding workflow was not available in the event workspace");
      const managerReportHtml = await (await fetch(`${frontend}/dashboard/events/${eventA.slug}/reconciliation`, { headers: { Cookie: managerCookie } })).text();
      assert(!managerReportHtml.includes("Access restricted") && managerReportHtml.includes("Reconciliation"), "Manager closure oversight was hidden");
      const accountsHtml = await (await fetch(`${frontend}/dashboard/users`, { headers: { Cookie: adminCookie } })).text();
      assert(accountsHtml.includes("Platform accounts") && accountsHtml.includes("Create account"), "System account administration did not render");
      const platformHtml = await (await fetch(`${frontend}/dashboard/complaints?search=Scope+platform+complaint&complaintId=${platformComplaint.id}`, { headers: { Cookie: adminCookie } })).text();
      assert(platformHtml.includes("Scope platform complaint") && platformHtml.includes("Start review") && !platformHtml.includes("Complaint workflow controls are disabled"), "System platform complaint workflow was unavailable");
      checks += 8;
      if (process.env.VERIFY_BROWSER === "1") {
        const browserStudentId = `B${runId.slice(0, 20)}`;
        const { data: browserStudent } = await request("/users", adminCookie, "POST", { fullName: "Scope browser student", email: `verify-student-${runId}@example.com`, studentId: browserStudentId, password, roleCodes: ["GENERAL_STUDENT"] }, 201);
        userIds.push(browserStudent.user.id);
        const { verifyBrowserWorkspaces } = await import("./verify-browser-workspaces");
        checks += await verifyBrowserWorkspaces({ frontend, eventSlug: eventA.slug, eventId: eventA.id, financeId: financeA.id, otherSlug: eventB.slug,
          financeEmail: financeA.email, studentId: browserStudentId, studentUserId: browserStudent.user.id, password, adminCookie, managerCookie, approverCookie });
      }
    }

    // Replace, then revoke. The existing cookie must lose event A immediately.
    const replacements = await Promise.all([createAccount("replacement-1", passwordHash), createAccount("replacement-2", passwordHash)]);
    for (const replacement of replacements) await request(`/events/${eventA.slug}/team-members`, adminCookie, "POST", { email: replacement.email, roleCode: "FINANCIAL_CONTROLLER" });
    const originalMember = eventA.teamMembers.find((member) => member.user.id === financeA.id)!;
    await request(`/events/${eventA.slug}/team-members/${originalMember.id}`, adminCookie, "DELETE");
    await request(`/payments/income-records?eventId=${eventA.id}`, financeCookie, "GET", undefined, 403);
    await request(`/requests/budget-requests?eventId=${eventB.id}`, financeCookie);

    const replacementMembers = await prisma.eventTeamMember.findMany({ where: { eventId: eventA.id, revokedAt: null, roleCode: RoleCode.FINANCIAL_CONTROLLER } });
    const removals = await Promise.all(replacementMembers.map((member) => fetch(`${baseUrl}/api/events/${eventA.slug}/team-members/${member.id}`, { method: "DELETE", headers: { Cookie: adminCookie } })));
    assert.deepEqual(removals.map((response) => response.status).sort(), [200, 409], "Concurrent revocations orphaned a required event role");
    assert.equal(await prisma.eventTeamMember.count({ where: { eventId: eventA.id, revokedAt: null, roleCode: RoleCode.FINANCIAL_CONTROLLER } }), 1);
    assert(await prisma.auditLog.count({ where: { eventId: eventA.id, actorId: admin.id, action: "events.team.revoke" } }) > 0, "Event-scoped audit context was not persisted");
    checks += 3;

    // A membership removal and account deactivation share the same invariant.
    const backup = await createAccount("finance-backup", passwordHash);
    await request(`/events/${eventA.slug}/team-members`, adminCookie, "POST", { email: backup.email, roleCode: "FINANCIAL_CONTROLLER" });
    const remaining = await prisma.eventTeamMember.findFirstOrThrow({ where: { eventId: eventA.id, revokedAt: null, roleCode: RoleCode.FINANCIAL_CONTROLLER, userId: { not: backup.id } } });
    const mixedChanges = await Promise.all([
      fetch(`${baseUrl}/api/events/${eventA.slug}/team-members/${remaining.id}`, { method: "DELETE", headers: { Cookie: adminCookie } }),
      fetch(`${baseUrl}/api/users/${backup.id}/status`, { method: "PATCH", headers: { Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ status: "INACTIVE" }) }),
    ]);
    assert.deepEqual(mixedChanges.map((response) => response.status).sort(), [200, 409], "Concurrent status and membership changes orphaned event finance");
    assert.equal(await prisma.eventTeamMember.count({ where: { eventId: eventA.id, revokedAt: null, roleCode: RoleCode.FINANCIAL_CONTROLLER, user: { status: "ACTIVE" } } }), 1);
    checks += 2;

    // Account management exposes global roles only and persists its audit.
    await request("/users", adminCookie, "POST", { fullName: "Scope incomplete student", email: `verify-missing-${runId}@example.com`, password, roleCodes: ["GENERAL_STUDENT"] }, 400);
    const managedStudentId = `M${runId.slice(0, 20)}`;
    const { data: createdAccount } = await request("/users", adminCookie, "POST", { fullName: "Scope managed account", email: `verify-managed-${runId}@example.com`, studentId: managedStudentId, password, roleCodes: ["GENERAL_STUDENT"] }, 201);
    userIds.push(createdAccount.user.id);
    await request("/auth/login", "", "POST", { studentId: managedStudentId, password });
    await request(`/users/${createdAccount.user.id}/profile`, financeCookie, "PATCH", { fullName: "Unauthorized change" }, 403);
    await request(`/users/${createdAccount.user.id}/profile`, adminCookie, "PATCH", { fullName: "Scope corrected profile" });
    await request("/roles/assignments", adminCookie, "POST", { userId: createdAccount.user.id, roleCode: "FINANCIAL_CONTROLLER" }, 400);
    const { data: promoted } = await request("/roles/assignments", adminCookie, "POST", { userId: createdAccount.user.id, roleCode: "SYSTEM_ADMIN" }, 201);
    await request(`/roles/assignments/${promoted.assignment.id}`, adminCookie, "DELETE");
    await request(`/users/${createdAccount.user.id}/status`, adminCookie, "PATCH", { status: "INACTIVE" });
    assert(await prisma.auditLog.count({ where: { entityId: createdAccount.user.id, action: "users.create" } }) === 1, "Account creation audit missing");
    checks += 1;
    console.log(`Event workspace verification passed (${checks} HTTP and boundary checks${frontend ? ", including rendered frontend routes" : ""}).`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const uploadedFixtures = await prisma.supportingDocument.findMany({ where: { uploadedById: { in: userIds } }, select: { relativePath: true } });
    for (const document of uploadedFixtures) await storageProvider.removeFile(document.relativePath);
    await prisma.$transaction(async (tx) => {
      // Event deletion cascades event records; audit rows are removed first.
      await tx.auditLog.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, { actorId: { in: userIds } }] } });
      await tx.complaint.deleteMany({ where: { id: { in: platformComplaintIds } } });
      await tx.event.deleteMany({ where: { id: { in: eventIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    });
    if (evidencePath) await unlink(evidencePath);
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error("Event workspace verification failed.", error); process.exitCode = 1; });
