import type {
  ApprovalQueueItem,
  AuditLogRecord,
  BudgetRecord,
  BudgetRequestRecord,
  ComplaintQueueItem,
  ComplaintRecord,
  ExpenseRecord,
  ExpenseRequestRecord,
  IncomeRecord,
  ManagedEvent,
  PaymentVerificationQueueItem,
  ReconciliationReport,
} from "@/types";

import { apiFetchServer } from "@/lib/api/server";

type QueryValue = string | undefined;

export async function listManagedEvents(query?: {
  status?: QueryValue;
  search?: QueryValue;
}) {
  const response = await apiFetchServer<{ events: ManagedEvent[] }>("/events/manage/list", {
    query,
  });

  return response.events;
}

export async function listInternalEventOptions() {
  const events = await listManagedEvents();

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    slug: event.slug,
    status: event.status,
  }));
}

export async function listPaymentVerificationQueue(query?: {
  eventId?: QueryValue;
  search?: QueryValue;
}) {
  const response = await apiFetchServer<{ queue: PaymentVerificationQueueItem[] }>(
    "/payments/verification-queue",
    {
      query,
    },
  );

  return response.queue;
}

export async function listIncomeRecords(query?: {
  eventId?: QueryValue;
  search?: QueryValue;
}) {
  const response = await apiFetchServer<{ incomeRecords: IncomeRecord[] }>(
    "/payments/income-records",
    {
      query,
    },
  );

  return response.incomeRecords;
}

export async function getIncomeRecord(incomeRecordId: string) {
  const response = await apiFetchServer<{ incomeRecord: IncomeRecord }>(
    `/payments/income-records/${incomeRecordId}`,
  );

  return response.incomeRecord;
}

export async function listBudgets(query?: {
  eventId?: QueryValue;
  state?: QueryValue;
  isActive?: QueryValue;
}) {
  const response = await apiFetchServer<{ budgets: BudgetRecord[] }>("/budgets", {
    query,
  });

  return response.budgets;
}

export async function getBudget(budgetId: string) {
  const response = await apiFetchServer<{ budget: BudgetRecord }>(`/budgets/${budgetId}`);
  return response.budget;
}

export async function listBudgetRequests(query?: {
  eventId?: QueryValue;
  state?: QueryValue;
}) {
  const response = await apiFetchServer<{ budgetRequests: BudgetRequestRecord[] }>(
    "/requests/budget-requests",
    {
      query,
    },
  );

  return response.budgetRequests;
}

export async function listMyBudgetRequests() {
  const response = await apiFetchServer<{ budgetRequests: BudgetRequestRecord[] }>(
    "/requests/budget-requests/mine",
  );

  return response.budgetRequests;
}

export async function getBudgetRequest(budgetRequestId: string) {
  const response = await apiFetchServer<{ budgetRequest: BudgetRequestRecord }>(
    `/requests/budget-requests/${budgetRequestId}`,
  );

  return response.budgetRequest;
}

export async function listExpenseRequests(query?: {
  eventId?: QueryValue;
  state?: QueryValue;
}) {
  const response = await apiFetchServer<{ expenseRequests: ExpenseRequestRecord[] }>(
    "/requests/expense-requests",
    {
      query,
    },
  );

  return response.expenseRequests;
}

export async function listMyExpenseRequests() {
  const response = await apiFetchServer<{ expenseRequests: ExpenseRequestRecord[] }>(
    "/requests/expense-requests/mine",
  );

  return response.expenseRequests;
}

export async function getExpenseRequest(expenseRequestId: string) {
  const response = await apiFetchServer<{ expenseRequest: ExpenseRequestRecord }>(
    `/requests/expense-requests/${expenseRequestId}`,
  );

  return response.expenseRequest;
}

export async function listExpenseRecords(query?: {
  eventId?: QueryValue;
  state?: QueryValue;
  expenseRequestId?: QueryValue;
}) {
  const response = await apiFetchServer<{ expenseRecords: ExpenseRecord[] }>(
    "/requests/expense-records",
    {
      query,
    },
  );

  return response.expenseRecords;
}

export async function getExpenseRecord(expenseRecordId: string) {
  const response = await apiFetchServer<{ expenseRecord: ExpenseRecord }>(
    `/requests/expense-records/${expenseRecordId}`,
  );

  return response.expenseRecord;
}

export async function listApprovalQueue(query?: {
  entityType?: QueryValue;
  eventId?: QueryValue;
}) {
  const response = await apiFetchServer<{ queue: ApprovalQueueItem[] }>("/approvals/queue", {
    query,
  });

  return response.queue;
}

export async function listComplaintReviewQueue(query?: {
  eventId?: QueryValue;
  state?: QueryValue;
  search?: QueryValue;
}) {
  const response = await apiFetchServer<{ complaints: ComplaintQueueItem[] }>(
    "/complaints/review-queue",
    {
      query,
    },
  );

  return response.complaints;
}

export async function getComplaint(complaintId: string) {
  const response = await apiFetchServer<{ complaint: ComplaintRecord }>(
    `/complaints/${complaintId}`,
  );

  return response.complaint;
}

export async function listReconciliationReports(query?: {
  eventId?: QueryValue;
  status?: QueryValue;
}) {
  const response = await apiFetchServer<{ reports: ReconciliationReport[] }>("/reconciliation", {
    query,
  });

  return response.reports;
}

export async function getReconciliationReport(reportId: string) {
  const response = await apiFetchServer<{ report: ReconciliationReport }>(
    `/reconciliation/${reportId}`,
  );

  return response.report;
}

export async function listAuditLogs(query?: {
  actorId?: QueryValue;
  entityType?: QueryValue;
  entityId?: QueryValue;
  limit?: QueryValue;
}) {
  const response = await apiFetchServer<{ logs: AuditLogRecord[] }>("/audit", {
    query,
  });

  return response.logs;
}

export async function getAuditLog(auditLogId: string) {
  const response = await apiFetchServer<{ log: AuditLogRecord }>(`/audit/${auditLogId}`);
  return response.log;
}
