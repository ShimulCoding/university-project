import { apiList, apiOptions } from "@/lib/api/list";
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

export async function listManagedEvents(query?: { page?: string;
  status?: QueryValue;
  search?: QueryValue;
}) {
  return apiList<ManagedEvent>("/events/manage/list", "events", query);
}

export async function listInternalEventOptions() {
  const events = await apiOptions<ManagedEvent>("/events/manage/list", "events");

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    slug: event.slug,
    status: event.status,
  }));
}

export async function listPaymentVerificationQueue(query?: { page?: string;
  eventId?: QueryValue;
  search?: QueryValue;
}) {
  return apiList<PaymentVerificationQueueItem>("/payments/verification-queue", "queue", query);
}

export async function listIncomeRecords(query?: { page?: string;
  eventId?: QueryValue;
  search?: QueryValue;
}) {
  return apiList<IncomeRecord>("/payments/income-records", "incomeRecords", query);
}

export async function getIncomeRecord(incomeRecordId: string) {
  const response = await apiFetchServer<{ incomeRecord: IncomeRecord }>(
    `/payments/income-records/${incomeRecordId}`,
  );

  return response.incomeRecord;
}

export async function listBudgets(query?: { page?: string;
  eventId?: QueryValue;
  state?: QueryValue;
  isActive?: QueryValue;
}) {
  return apiList<BudgetRecord>("/budgets", "budgets", query);
}

export async function getBudget(budgetId: string) {
  const response = await apiFetchServer<{ budget: BudgetRecord }>(`/budgets/${budgetId}`);
  return response.budget;
}

export async function listBudgetRequests(query?: { page?: string;
  eventId?: QueryValue;
  state?: QueryValue;
}) {
  return apiList<BudgetRequestRecord>("/requests/budget-requests", "budgetRequests", query);
}

export async function listMyBudgetRequests(page?: string) {
  return apiList<BudgetRequestRecord>("/requests/budget-requests/mine", "budgetRequests", { page });
}

export async function getBudgetRequest(budgetRequestId: string) {
  const response = await apiFetchServer<{ budgetRequest: BudgetRequestRecord }>(
    `/requests/budget-requests/${budgetRequestId}`,
  );

  return response.budgetRequest;
}

export async function listExpenseRequests(query?: { page?: string;
  eventId?: QueryValue;
  state?: QueryValue;
}) {
  return apiList<ExpenseRequestRecord>("/requests/expense-requests", "expenseRequests", query);
}

export async function listMyExpenseRequests(page?: string) {
  return apiList<ExpenseRequestRecord>("/requests/expense-requests/mine", "expenseRequests", { page });
}

export async function getExpenseRequest(expenseRequestId: string) {
  const response = await apiFetchServer<{ expenseRequest: ExpenseRequestRecord }>(
    `/requests/expense-requests/${expenseRequestId}`,
  );

  return response.expenseRequest;
}

export async function listExpenseRecords(query?: { page?: string;
  eventId?: QueryValue;
  state?: QueryValue;
  expenseRequestId?: QueryValue;
}) {
  return apiList<ExpenseRecord>("/requests/expense-records", "expenseRecords", query);
}

export async function getExpenseRecord(expenseRecordId: string) {
  const response = await apiFetchServer<{ expenseRecord: ExpenseRecord }>(
    `/requests/expense-records/${expenseRecordId}`,
  );

  return response.expenseRecord;
}

export async function listApprovalQueue(query?: { page?: string;
  entityType?: QueryValue;
  eventId?: QueryValue;
}) {
  return apiList<ApprovalQueueItem>("/approvals/queue", "queue", query);
}

export async function listComplaintReviewQueue(query?: { page?: string;
  eventId?: QueryValue;
  state?: QueryValue;
  search?: QueryValue;
}) {
  return apiList<ComplaintQueueItem>("/complaints/review-queue", "complaints", query);
}

export async function getComplaint(complaintId: string) {
  const response = await apiFetchServer<{ complaint: ComplaintRecord }>(
    `/complaints/${complaintId}`,
  );

  return response.complaint;
}

export async function listReconciliationReports(query?: { page?: string;
  eventId?: QueryValue;
  status?: QueryValue;
}) {
  return apiList<ReconciliationReport>("/reconciliation", "reports", query);
}

export async function getReconciliationReport(reportId: string) {
  const response = await apiFetchServer<{ report: ReconciliationReport }>(
    `/reconciliation/${reportId}`,
  );

  return response.report;
}

export async function listAuditLogs(query?: { page?: string;
  actorId?: QueryValue;
  entityType?: QueryValue;
  entityId?: QueryValue;
  limit?: QueryValue;
}) {
  return apiList<AuditLogRecord>("/audit", "logs", query);
}

export async function getAuditLog(auditLogId: string) {
  const response = await apiFetchServer<{ log: AuditLogRecord }>(`/audit/${auditLogId}`);
  return response.log;
}
