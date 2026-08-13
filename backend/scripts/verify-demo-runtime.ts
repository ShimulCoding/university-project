import { loadProjectEnv } from "../src/config/load-env";

loadProjectEnv();

const baseUrl = process.env.BACKEND_BASE_URL?.trim() || "http://127.0.0.1:4000";
const demoActiveEventSlug = "demo-open-finance-workshop-2026";
const demoClosedEventSlug = "demo-cse-annual-tech-symposium-2026";

function assertCondition(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchJson(
  path: string,
  options: RequestInit & { expectedStatus?: number } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const expectedStatus = options.expectedStatus ?? 200;
  const body = await readJson(response);

  if (response.status !== expectedStatus) {
    throw new Error(
      `${options.method ?? "GET"} ${path} returned ${response.status} instead of ${expectedStatus}. Body: ${JSON.stringify(body)}`,
    );
  }

  return body as Record<string, unknown>;
}

function buildCookieHeader(response: Response) {
  const headersWithSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookieHeaders = headersWithSetCookie.getSetCookie?.() ?? [];

  if (setCookieHeaders.length === 0) {
    const mergedHeader = response.headers.get("set-cookie");

    if (!mergedHeader) {
      return "";
    }

    return mergedHeader
      .split(/,(?=[^;,\s]+=)/)
      .map((value) => value.split(";")[0]?.trim())
      .filter(Boolean)
      .join("; ");
  }

  return setCookieHeaders
    .map((value) => value.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function loginAsSeedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  assertCondition(email, "SEED_ADMIN_EMAIL is missing from the backend environment.");
  assertCondition(password, "SEED_ADMIN_PASSWORD is missing from the backend environment.");

  const response = await fetch(`${baseUrl}/api/auth/internal-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(`Admin login failed with ${response.status}. Body: ${JSON.stringify(body)}`);
  }

  const cookieHeader = buildCookieHeader(response);

  assertCondition(cookieHeader, "Admin login did not return authentication cookies.");

  return {
    cookieHeader,
    body,
  };
}

async function loginAsEventTeam(email: string, eventLookupKey: string) {
  const response = await fetch(`${baseUrl}/api/auth/event-team-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: "DemoPass123!",
      eventLookupKey,
    }),
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      `Event team login for ${email} failed with ${response.status}. Body: ${JSON.stringify(body)}`,
    );
  }

  const cookieHeader = buildCookieHeader(response);
  assertCondition(cookieHeader, `Event team login for ${email} did not return cookies.`);

  return { cookieHeader, body };
}

async function main() {
  const health = await fetchJson("/health");
  assertCondition(health.status === "ok", "Health endpoint did not return ok status.");

  const publicEventsResponse = await fetchJson("/api/events");
  const publicEvents = Array.isArray(publicEventsResponse.events)
    ? publicEventsResponse.events
    : [];

  assertCondition(publicEvents.length >= 2, "Public events list should contain demo events.");
  assertCondition(
    publicEvents.some((event) => event && typeof event === "object" && event.slug === demoActiveEventSlug),
    `Public events list does not include ${demoActiveEventSlug}.`,
  );
  assertCondition(
    publicEvents.some((event) => event && typeof event === "object" && event.slug === demoClosedEventSlug),
    `Public events list does not include ${demoClosedEventSlug}.`,
  );

  const publicSummariesResponse = await fetchJson("/api/public/financial-summaries");
  const publicSummaries = Array.isArray(publicSummariesResponse.summaries)
    ? publicSummariesResponse.summaries
    : [];

  assertCondition(
    publicSummaries.length >= 1,
    "Public financial summaries should contain at least one published demo summary.",
  );

  const publicSummaryDetail = await fetchJson(
    `/api/public/financial-summaries/${demoClosedEventSlug}`,
  );
  const summary = publicSummaryDetail.summary as
    | {
        totals?: { collected?: string; spent?: string; closingBalance?: string };
        event?: { slug?: string };
        payload?: { summaryOnly?: boolean };
      }
    | undefined;
  const collected = Number(summary?.totals?.collected);
  const spent = Number(summary?.totals?.spent);
  const closingBalance = Number(summary?.totals?.closingBalance);

  assertCondition(summary?.event?.slug === demoClosedEventSlug, "Public summary slug mismatch.");
  assertCondition(
    Number.isFinite(collected) && Number.isFinite(spent) && Number.isFinite(closingBalance),
    "Public summary totals should be numeric values.",
  );
  assertCondition(
    collected > 0 && spent >= 0,
    "Public summary totals should reflect a real published financial outcome.",
  );
  assertCondition(
    Math.abs((collected - spent) - closingBalance) < 0.0001,
    "Public summary closing balance does not reconcile with collected minus spent totals.",
  );
  assertCondition(summary?.payload?.summaryOnly === true, "Public summary must remain summary-only.");

  const login = await loginAsSeedAdmin();
  const authHeaders = {
    Cookie: login.cookieHeader,
  };

  const meResponse = await fetchJson("/api/auth/me", {
    headers: authHeaders,
  });
  assertCondition(
    (meResponse.user as { email?: string } | undefined)?.email === process.env.SEED_ADMIN_EMAIL,
    "Authenticated admin profile did not match the seeded admin user.",
  );

  await fetchJson("/api/auth/internal-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "demo.finance@example.com",
      password: "DemoPass123!",
    }),
    expectedStatus: 403,
  });

  const [financeLogin, eventManagerLogin, approverLogin] = await Promise.all([
    loginAsEventTeam("demo.finance@example.com", demoActiveEventSlug),
    loginAsEventTeam("demo.event.manager@example.com", demoActiveEventSlug),
    loginAsEventTeam("demo.approver@example.com", demoActiveEventSlug),
  ]);
  const financeHeaders = { Cookie: financeLogin.cookieHeader };
  const eventManagerHeaders = { Cookie: eventManagerLogin.cookieHeader };
  const approverHeaders = { Cookie: approverLogin.cookieHeader };

  const financeProfile = await fetchJson("/api/auth/me", { headers: financeHeaders });
  const financeEventRoles =
    (financeProfile.user as { eventRoles?: Array<{ roleCode?: string; event?: { slug?: string } }> })
      ?.eventRoles ?? [];
  assertCondition(
    financeEventRoles.some(
      (assignment) =>
        assignment.roleCode === "FINANCIAL_CONTROLLER" &&
        assignment.event?.slug === demoActiveEventSlug,
    ),
    "Finance account did not expose its active event assignment.",
  );

  const verificationQueueResponse = await fetchJson("/api/payments/verification-queue", {
    headers: financeHeaders,
  });
  const verificationQueue = Array.isArray(verificationQueueResponse.queue)
    ? verificationQueueResponse.queue
    : [];

  assertCondition(
    verificationQueue.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as { event?: { slug?: string } }).event?.slug === demoActiveEventSlug,
    ),
    "Payment verification queue does not contain the seeded active-event payment proof.",
  );

  const incomeRecordsResponse = await fetchJson("/api/payments/income-records", {
    headers: financeHeaders,
  });
  const incomeRecords = Array.isArray(incomeRecordsResponse.incomeRecords)
    ? incomeRecordsResponse.incomeRecords
    : [];

  assertCondition(
    incomeRecords.some(
      (record) =>
        record &&
        typeof record === "object" &&
        (record as { sourceLabel?: string }).sourceLabel === "Tech Partners Ltd. Sponsorship",
    ),
    "Income record list does not contain the verified sponsorship demo record.",
  );

  const budgetRequestsResponse = await fetchJson("/api/requests/budget-requests", {
    headers: eventManagerHeaders,
  });
  const budgetRequests = Array.isArray(budgetRequestsResponse.budgetRequests)
    ? budgetRequestsResponse.budgetRequests
    : [];

  assertCondition(
    budgetRequests.some(
      (request) =>
        request &&
        typeof request === "object" &&
        (request as { purpose?: string }).purpose === "Demo pending banner and volunteer kit request",
    ),
    "Budget request list does not contain the pending demo approval item.",
  );

  const expenseRecordsResponse = await fetchJson("/api/requests/expense-records", {
    headers: financeHeaders,
  });
  const expenseRecords = Array.isArray(expenseRecordsResponse.expenseRecords)
    ? expenseRecordsResponse.expenseRecords
    : [];

  assertCondition(
    expenseRecords.some(
      (record) =>
        record &&
        typeof record === "object" &&
        (record as { description?: string; state?: string }).description ===
          "Demo settled closing operations expense" &&
        (record as { description?: string; state?: string }).state === "SETTLED",
    ),
    "Expense record list does not contain the settled demo expense record.",
  );

  const approvalsQueueResponse = await fetchJson("/api/approvals/queue", {
    headers: approverHeaders,
  });
  const approvalsQueue = Array.isArray(approvalsQueueResponse.queue)
    ? approvalsQueueResponse.queue
    : [];

  assertCondition(
    approvalsQueue.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as { event?: { slug?: string } }).event?.slug === demoActiveEventSlug,
    ),
    "Approval queue does not contain the pending active-event request.",
  );

  const reconciliationResponse = await fetchJson("/api/reconciliation", {
    headers: financeHeaders,
  });
  const reconciliationReports = Array.isArray(reconciliationResponse.reports)
    ? reconciliationResponse.reports
    : [];

  assertCondition(
    reconciliationReports.some(
      (report) =>
        report &&
        typeof report === "object" &&
        (report as { event?: { slug?: string }; status?: string }).event?.slug ===
          demoClosedEventSlug &&
        (report as { event?: { slug?: string }; status?: string }).status === "FINALIZED",
    ),
    "Reconciliation report list does not contain the finalized closed-event report.",
  );

  console.log("Backend demo runtime verification passed.");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Public events: ${publicEvents.length}`);
  console.log(`Public summaries: ${publicSummaries.length}`);
  console.log(`Verification queue items: ${verificationQueue.length}`);
  console.log(`Income records: ${incomeRecords.length}`);
  console.log(`Budget requests: ${budgetRequests.length}`);
  console.log(`Expense records: ${expenseRecords.length}`);
  console.log(`Approval queue items: ${approvalsQueue.length}`);
  console.log(`Reconciliation reports: ${reconciliationReports.length}`);
}

void main().catch((error) => {
  console.error("Backend demo runtime verification failed.", error);
  process.exit(1);
});
