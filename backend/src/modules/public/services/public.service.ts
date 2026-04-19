import { EventStatus, ReconciliationState } from "@prisma/client";

import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { hasPublicSummaryPublishAccess } from "../../../utils/role-checks";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { getReconciliationPayload } from "../../reconciliation/reconciliation.mappers";
import { reconciliationRepository } from "../../reconciliation/repositories/reconciliation.repository";
import { mapPublicFinancialSummary } from "../public.mappers";
import { publicRepository } from "../repositories/public.repository";
import type { PublicFinancialSummaryPayload, PublicSummaryFilters } from "../types/public.types";

const publishableEventStatuses: EventStatus[] = [
  EventStatus.COMPLETED,
  EventStatus.CLOSED,
];

function assertPublishPermissions(actor: AuthenticatedUser) {
  if (!hasPublicSummaryPublishAccess(actor.roles)) {
    throw new AppError(403, "You are not allowed to publish public financial summaries.");
  }
}

function assertReportEventSnapshotIsCurrent(
  report: NonNullable<Awaited<ReturnType<typeof reconciliationRepository.findReportById>>>,
) {
  const snapshot = getReconciliationPayload(report).eventSnapshot;

  if (!snapshot) {
    throw new AppError(
      409,
      "This reconciliation report was generated before event snapshot tracking. Generate and finalize a fresh report before publishing.",
    );
  }

  if (
    snapshot.eventId !== report.event.id ||
    snapshot.status !== report.event.status ||
    snapshot.updatedAt !== report.event.updatedAt.toISOString()
  ) {
    throw new AppError(
      409,
      "This reconciliation report is stale because the event changed after generation. Generate and finalize a fresh report before publishing.",
    );
  }
}

function buildPublicPayload(
  report: NonNullable<Awaited<ReturnType<typeof reconciliationRepository.findReportById>>>,
): PublicFinancialSummaryPayload {
  const reconciliationPayload = getReconciliationPayload(report);

  return {
    basis: "FINALIZED_RECONCILIATION",
    summaryOnly: true,
    breakdown: {
      registrationIncome: reconciliationPayload.breakdown.verifiedRegistrationIncome,
      manualIncome: reconciliationPayload.breakdown.manualIncome,
      settledExpense: reconciliationPayload.breakdown.settledExpense,
    },
    incomeBreakdown: reconciliationPayload.incomeBreakdown,
    expenseBreakdown: reconciliationPayload.expenseBreakdown,
  };
}

export const publicService = {
  async listPublishedFinancialSummaries(filters: PublicSummaryFilters) {
    const paginationOptions = getPaginationOptions(filters);
    const [summaries, totalItems] = await Promise.all([
      publicRepository.listPublishedSummaries(filters, paginationOptions),
      publicRepository.countPublishedSummaries(filters),
    ]);

    return {
      summaries: summaries.map(mapPublicFinancialSummary),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getPublishedFinancialSummary(eventLookup: string) {
    const summary = await publicRepository.findPublishedSummaryByEventLookup(eventLookup);

    if (!summary) {
      throw new AppError(404, "Published public financial summary not found.");
    }

    return mapPublicFinancialSummary(summary);
  },

  async unpublishFinancialSummary(
    actor: AuthenticatedUser,
    publicSummaryId: string,
    auditMetadata?: AuditMetadata,
  ) {
    assertPublishPermissions(actor);

    const summary = await publicRepository.findSummaryById(publicSummaryId);

    if (!summary) {
      throw new AppError(404, "Public financial summary not found.");
    }

    if (summary.status !== "PUBLISHED") {
      throw new AppError(409, "Only published summaries can be unpublished.");
    }

    const unpublishedSummary = await publicRepository.unpublishSummary(publicSummaryId);

    await auditService.record({
      actorId: actor.id,
      action: "public_summary.unpublish",
      entityType: "PublicSummarySnapshot",
      entityId: unpublishedSummary.id,
      summary: `Unpublished public financial summary for ${unpublishedSummary.event.title}`,
      context: {
        eventId: unpublishedSummary.event.id,
        reconciliationReportId: unpublishedSummary.reconciliationReportId,
        status: unpublishedSummary.status,
      },
      ...auditMetadata,
    });

    return mapPublicFinancialSummary(unpublishedSummary);
  },

  async publishFinancialSummary(
    actor: AuthenticatedUser,
    reconciliationReportId: string,
    auditMetadata?: AuditMetadata,
  ) {
    assertPublishPermissions(actor);

    const report = await reconciliationRepository.findReportById(reconciliationReportId);

    if (!report) {
      throw new AppError(404, "Reconciliation report not found.");
    }

    if (report.status !== ReconciliationState.FINALIZED) {
      throw new AppError(409, "Only finalized reconciliation reports can be published publicly.");
    }

    if (report.isStale) {
      throw new AppError(
        409,
        "This reconciliation report is stale because event financial records changed. Generate and finalize a fresh report before publishing.",
      );
    }

    assertReportEventSnapshotIsCurrent(report);

    if (!publishableEventStatuses.includes(report.event.status)) {
      throw new AppError(
        409,
        "Public summaries can only be published after the event is completed or closed.",
      );
    }

    const existingSummary = await publicRepository.findPublishedSummaryByReportId(report.id);

    if (existingSummary) {
      return mapPublicFinancialSummary(existingSummary);
    }

    const publicSummary = await publicRepository.createPublishedSummary({
      eventId: report.event.id,
      reconciliationReportId: report.id,
      publishedById: actor.id,
      totalCollected: report.totalIncome.toString(),
      totalSpent: report.totalExpense.toString(),
      closingBalance: report.closingBalance.toString(),
      payload: buildPublicPayload(report),
    });

    await auditService.record({
      actorId: actor.id,
      action: "public_summary.publish",
      entityType: "PublicSummarySnapshot",
      entityId: publicSummary.id,
      summary: `Published public financial summary for ${publicSummary.event.title}`,
      context: {
        eventId: publicSummary.event.id,
        reconciliationReportId: report.id,
        status: publicSummary.status,
      },
      ...auditMetadata,
    });

    return mapPublicFinancialSummary(publicSummary);
  },
};
