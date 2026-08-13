import { ComplaintState, DocumentCategory, RoleCode } from "@prisma/client";

import { documentDirectories, uploadRules } from "../../../config/uploads";
import { prisma } from "../../../config/prisma";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import {
  assertAnyEventScopedAccess,
  assertEventScopedOperationalAccess,
  assertSystemAdminOrEventRole,
  hasEventScopedRole,
  isSystemAdmin,
  scopeEventFilters,
} from "../../../utils/event-scope";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { sanitizeOptionalText } from "../../../utils/text-utils";
import { cleanupStoredUpload, cleanupStoredUploads, storeValidatedUpload } from "../../../utils/upload-utils";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { eventsRepository } from "../../events/repositories/events.repository";
import { rolesRepository } from "../../roles/repositories/roles.repository";
import {
  mapComplaintForReview,
  mapComplaintForSubmitter,
  mapComplaintQueueItem,
} from "../complaints.mappers";
import { complaintsRepository } from "../repositories/complaints.repository";
import type {
  CloseComplaintInput,
  ComplaintQueueFilters,
  ComplaintRoutingRoleCode,
  CreateComplaintInput,
  EscalateComplaintInput,
  ResolveComplaintInput,
  ReviewComplaintInput,
  RouteComplaintInput,
} from "../types/complaints.types";

async function storeComplaintEvidence(file: Express.Multer.File) {
  return storeValidatedUpload(file, {
    category: DocumentCategory.COMPLAINT_EVIDENCE,
    destinationDir: documentDirectories.COMPLAINT_EVIDENCE,
    rule: uploadRules.COMPLAINT_EVIDENCE,
    documentName: "complaint evidence",
  });
}

const allowedComplaintTransitions: Record<ComplaintState, ComplaintState[]> = {
  [ComplaintState.SUBMITTED]: [
    ComplaintState.UNDER_REVIEW,
    ComplaintState.ROUTED,
    ComplaintState.ESCALATED,
  ],
  [ComplaintState.UNDER_REVIEW]: [
    ComplaintState.ROUTED,
    ComplaintState.ESCALATED,
    ComplaintState.RESOLVED,
  ],
  [ComplaintState.ROUTED]: [
    ComplaintState.UNDER_REVIEW,
    ComplaintState.ESCALATED,
    ComplaintState.RESOLVED,
  ],
  [ComplaintState.ESCALATED]: [
    ComplaintState.UNDER_REVIEW,
    ComplaintState.ROUTED,
    ComplaintState.RESOLVED,
  ],
  [ComplaintState.RESOLVED]: [ComplaintState.CLOSED],
  [ComplaintState.CLOSED]: [],
};

const complaintReviewEventRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.COMPLAINT_REVIEW_AUTHORITY,
  RoleCode.ORGANIZATIONAL_APPROVER,
] as RoleCode[];

function assertHasAnyComplaintReviewAssignment(viewer: AuthenticatedUser) {
  assertAnyEventScopedAccess(
    viewer,
    complaintReviewEventRoles,
    "You are not allowed to review complaints.",
  );
}

function assertComplaintReviewPermissions(viewer: AuthenticatedUser, eventId: string | null) {
  if (!eventId) {
    if (isSystemAdmin(viewer)) {
      return;
    }

    throw new AppError(403, "Only the System Admin can review complaints without an event scope.");
  }

  assertEventScopedOperationalAccess(
    viewer,
    eventId,
    complaintReviewEventRoles,
    "You are not assigned to review complaints for this event.",
  );
}

function assertComplaintAccess(
  viewer: AuthenticatedUser,
  eventId: string | null,
  submittedById: string | null | undefined,
) {
  if (submittedById === viewer.id) {
    return;
  }

  if (!eventId) {
    if (isSystemAdmin(viewer)) {
      return;
    }

    throw new AppError(403, "You are not allowed to access this complaint.");
  }

  assertSystemAdminOrEventRole(
    viewer,
    eventId,
    complaintReviewEventRoles,
    "You are not allowed to access this complaint.",
  );
}

function assertComplaintTransition(currentState: ComplaintState, nextState: ComplaintState) {
  if (currentState === nextState) {
    throw new AppError(409, `Complaint is already in ${nextState} state.`);
  }

  if (!allowedComplaintTransitions[currentState].includes(nextState)) {
    throw new AppError(
      409,
      `Complaint state cannot transition from ${currentState} to ${nextState}.`,
    );
  }
}

function getActorComplaintRoleCode(
  actor: AuthenticatedUser,
  eventId: string | null,
): ComplaintRoutingRoleCode | undefined {
  if (!eventId && isSystemAdmin(actor)) {
    return RoleCode.SYSTEM_ADMIN;
  }

  if (eventId && hasEventScopedRole(actor, eventId, [RoleCode.COMPLAINT_REVIEW_AUTHORITY])) {
    return RoleCode.COMPLAINT_REVIEW_AUTHORITY;
  }

  if (eventId && hasEventScopedRole(actor, eventId, [RoleCode.ORGANIZATIONAL_APPROVER])) {
    return RoleCode.ORGANIZATIONAL_APPROVER;
  }

  if (eventId && hasEventScopedRole(actor, eventId, [RoleCode.EVENT_ADMIN])) {
    return RoleCode.EVENT_ADMIN;
  }

  return undefined;
}

async function getRoleIdByCode(roleCode: ComplaintRoutingRoleCode | undefined) {
  if (!roleCode) {
    return undefined;
  }

  await rolesRepository.syncCatalog();
  const role = await rolesRepository.findByCode(roleCode);

  if (!role) {
    throw new AppError(404, `Role ${roleCode} not found.`);
  }

  return role.id;
}

async function transitionComplaint(
  actor: AuthenticatedUser,
  complaintId: string,
  nextState: ComplaintState,
  input: {
    note?: string | undefined;
    toRoleCode?: ComplaintRoutingRoleCode | undefined;
  },
  auditMetadata: AuditMetadata | undefined,
) {
  const complaint = await complaintsRepository.findComplaintById(complaintId);

  if (!complaint) {
    throw new AppError(404, "Complaint not found.");
  }

  assertComplaintReviewPermissions(actor, complaint.event?.id ?? null);
  assertComplaintTransition(complaint.state, nextState);

  const fromRoleId = await getRoleIdByCode(
    getActorComplaintRoleCode(actor, complaint.event?.id ?? null),
  );
  const toRoleId = await getRoleIdByCode(input.toRoleCode);
  const note = sanitizeOptionalText(input.note);

  const updatedComplaint = await prisma.$transaction(async (tx) => {
    await complaintsRepository.createRoutingHistory(
      {
        complaintId,
        state: nextState,
        fromRoleId,
        toRoleId,
        routedById: actor.id,
        note,
      },
      tx,
    );

    return complaintsRepository.updateComplaintState(complaintId, nextState, tx);
  });

  await auditService.record({
    actorId: actor.id,
    action: "complaints.transition",
    entityType: "Complaint",
    entityId: updatedComplaint.id,
    summary: `Moved complaint to ${nextState}`,
    context: {
      previousState: complaint.state,
      nextState,
      toRoleCode: input.toRoleCode ?? null,
      eventId: updatedComplaint.event?.id ?? null,
      note: note ?? null,
    },
    ...auditMetadata,
  });

  return mapComplaintForReview(updatedComplaint);
}

export const complaintsService = {
  async listMyComplaints(actor: AuthenticatedUser, filters: ComplaintQueueFilters) {
    const paginationOptions = getPaginationOptions(filters);
    const [complaints, totalItems] = await Promise.all([
      complaintsRepository.listComplaintsBySubmitter(actor.id, filters, paginationOptions),
      complaintsRepository.countComplaintsBySubmitter(actor.id, filters),
    ]);

    return {
      complaints: complaints.map(mapComplaintForSubmitter),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getComplaintById(viewer: AuthenticatedUser, complaintId: string) {
    const complaint = await complaintsRepository.findComplaintById(complaintId);

    if (!complaint) {
      throw new AppError(404, "Complaint not found.");
    }

    assertComplaintAccess(viewer, complaint.event?.id ?? null, complaint.submittedById);

    return isSystemAdmin(viewer) ||
      (complaint.event?.id &&
        hasEventScopedRole(viewer, complaint.event.id, complaintReviewEventRoles))
      ? mapComplaintForReview(complaint)
      : mapComplaintForSubmitter(complaint);
  },

  async createComplaint(
    actor: AuthenticatedUser,
    input: CreateComplaintInput,
    files: Express.Multer.File[] | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    if (input.eventId) {
      const event = await eventsRepository.findById(input.eventId);

      if (!event) {
        throw new AppError(404, "Event not found.");
      }
    }

    const storedUploads = files && files.length > 0 ? await Promise.all(files.map(storeComplaintEvidence)) : [];

    try {
      const complaint = await prisma.$transaction(async (tx) => {
        const createdComplaint = await complaintsRepository.createComplaint(
          {
            subject: input.subject,
            description: input.description,
            eventId: input.eventId,
            submittedById: actor.id,
          },
          tx,
        );

        await complaintsRepository.createRoutingHistory(
          {
            complaintId: createdComplaint.id,
            state: ComplaintState.SUBMITTED,
            note: "Complaint received and queued for internal review.",
          },
          tx,
        );

        if (storedUploads && storedUploads.length > 0) {
          await Promise.all(
            storedUploads.map((upload) =>
              complaintsRepository.createSupportingDocument(
                {
                  category: upload.category,
                  originalName: upload.originalName,
                  mimeType: upload.mimeType,
                  storedName: upload.storedName,
                  relativePath: upload.relativePath,
                  sizeBytes: BigInt(upload.sizeBytes),
                  uploadedById: actor.id,
                  complaintId: createdComplaint.id,
                },
                tx,
              )
            )
          );
        }

        const reloadedComplaint = await complaintsRepository.findComplaintById(
          createdComplaint.id,
          tx,
        );

        if (!reloadedComplaint) {
          throw new AppError(500, "Failed to reload the submitted complaint.");
        }

        return reloadedComplaint;
      });

      await auditService.record({
        actorId: actor.id,
        action: "complaints.submit",
        entityType: "Complaint",
        entityId: complaint.id,
        summary: `Submitted complaint: ${complaint.subject}`,
        context: {
          eventId: complaint.event?.id ?? null,
          hasEvidence: complaint.documents.length > 0,
          state: complaint.state,
        },
        ...auditMetadata,
      });

      return mapComplaintForSubmitter(complaint);
    } catch (error) {
      if (storedUploads && storedUploads.length > 0) {
        await cleanupStoredUploads(storedUploads.map((u) => ({ relativePath: u.relativePath })));
      }
      throw error;
    }
  },

  async listReviewQueue(viewer: AuthenticatedUser, filters: ComplaintQueueFilters) {
    assertHasAnyComplaintReviewAssignment(viewer);

    const scopedFilters = scopeEventFilters(viewer, filters, complaintReviewEventRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [complaints, totalItems] = await Promise.all([
      complaintsRepository.listReviewQueue(scopedFilters, paginationOptions),
      complaintsRepository.countReviewQueue(scopedFilters),
    ]);

    return {
      complaints: complaints.map(mapComplaintQueueItem),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async startReview(
    actor: AuthenticatedUser,
    complaintId: string,
    input: ReviewComplaintInput,
    auditMetadata?: AuditMetadata,
  ) {
    return transitionComplaint(
      actor,
      complaintId,
      ComplaintState.UNDER_REVIEW,
      input,
      auditMetadata,
    );
  },

  async routeComplaint(
    actor: AuthenticatedUser,
    complaintId: string,
    input: RouteComplaintInput,
    auditMetadata?: AuditMetadata,
  ) {
    return transitionComplaint(
      actor,
      complaintId,
      ComplaintState.ROUTED,
      input,
      auditMetadata,
    );
  },

  async escalateComplaint(
    actor: AuthenticatedUser,
    complaintId: string,
    input: EscalateComplaintInput,
    auditMetadata?: AuditMetadata,
  ) {
    return transitionComplaint(
      actor,
      complaintId,
      ComplaintState.ESCALATED,
      input,
      auditMetadata,
    );
  },

  async resolveComplaint(
    actor: AuthenticatedUser,
    complaintId: string,
    input: ResolveComplaintInput,
    auditMetadata?: AuditMetadata,
  ) {
    return transitionComplaint(
      actor,
      complaintId,
      ComplaintState.RESOLVED,
      input,
      auditMetadata,
    );
  },

  async closeComplaint(
    actor: AuthenticatedUser,
    complaintId: string,
    input: CloseComplaintInput,
    auditMetadata?: AuditMetadata,
  ) {
    return transitionComplaint(
      actor,
      complaintId,
      ComplaintState.CLOSED,
      input,
      auditMetadata,
    );
  },
};
