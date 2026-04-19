import { ComplaintState, DocumentCategory, RoleCode } from "@prisma/client";

import { documentDirectories, uploadRules } from "../../../config/uploads";
import { prisma } from "../../../config/prisma";
import { storageProvider } from "../../../storage";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { hasComplaintReviewAccess } from "../../../utils/role-checks";
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

type StoredUpload = {
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedName: string;
  relativePath: string;
};

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

function sanitizeOptionalText(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function assertComplaintEvidence(file: Express.Multer.File) {
  const rule = uploadRules.COMPLAINT_EVIDENCE;

  if (!rule.allowedMimeTypes.some((mimeType) => mimeType === file.mimetype)) {
    throw new AppError(400, "Uploaded file type is not allowed for complaint evidence.");
  }

  if (file.size > rule.maxFileSizeBytes) {
    throw new AppError(400, "Uploaded complaint evidence exceeds the maximum allowed size.");
  }
}

async function storeComplaintEvidence(file: Express.Multer.File): Promise<StoredUpload> {
  assertComplaintEvidence(file);

  const storedFile = await storageProvider.saveFile({
    buffer: file.buffer,
    destinationDir: documentDirectories.COMPLAINT_EVIDENCE,
    originalName: file.originalname,
  });

  return {
    category: DocumentCategory.COMPLAINT_EVIDENCE,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storedName: storedFile.storedName,
    relativePath: storedFile.relativePath,
  };
}

async function cleanupStoredUpload(upload: StoredUpload | undefined) {
  if (!upload) {
    return;
  }

  try {
    await storageProvider.removeFile(upload.relativePath);
  } catch {
    // Best effort cleanup only.
  }
}

function assertComplaintReviewPermissions(viewer: AuthenticatedUser) {
  if (!hasComplaintReviewAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to review complaints.");
  }
}

function assertComplaintAccess(viewer: AuthenticatedUser, submittedById: string | null | undefined) {
  if (submittedById === viewer.id || hasComplaintReviewAccess(viewer.roles)) {
    return;
  }

  throw new AppError(403, "You are not allowed to access this complaint.");
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

function getActorComplaintRoleCode(actor: AuthenticatedUser): ComplaintRoutingRoleCode | undefined {
  if (actor.roles.includes(RoleCode.SYSTEM_ADMIN)) {
    return RoleCode.SYSTEM_ADMIN;
  }

  if (actor.roles.includes(RoleCode.COMPLAINT_REVIEW_AUTHORITY)) {
    return RoleCode.COMPLAINT_REVIEW_AUTHORITY;
  }

  if (actor.roles.includes(RoleCode.ORGANIZATIONAL_APPROVER)) {
    return RoleCode.ORGANIZATIONAL_APPROVER;
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
  assertComplaintReviewPermissions(actor);

  const complaint = await complaintsRepository.findComplaintById(complaintId);

  if (!complaint) {
    throw new AppError(404, "Complaint not found.");
  }

  assertComplaintTransition(complaint.state, nextState);

  const fromRoleId = await getRoleIdByCode(getActorComplaintRoleCode(actor));
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

    assertComplaintAccess(viewer, complaint.submittedById);

    return hasComplaintReviewAccess(viewer.roles)
      ? mapComplaintForReview(complaint)
      : mapComplaintForSubmitter(complaint);
  },

  async createComplaint(
    actor: AuthenticatedUser,
    input: CreateComplaintInput,
    file: Express.Multer.File | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    if (input.eventId) {
      const event = await eventsRepository.findById(input.eventId);

      if (!event) {
        throw new AppError(404, "Event not found.");
      }
    }

    const storedUpload = file ? await storeComplaintEvidence(file) : undefined;

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

        if (storedUpload) {
          await complaintsRepository.createSupportingDocument(
            {
              category: storedUpload.category,
              originalName: storedUpload.originalName,
              mimeType: storedUpload.mimeType,
              storedName: storedUpload.storedName,
              relativePath: storedUpload.relativePath,
              sizeBytes: BigInt(storedUpload.sizeBytes),
              uploadedById: actor.id,
              complaintId: createdComplaint.id,
            },
            tx,
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
      await cleanupStoredUpload(storedUpload);
      throw error;
    }
  },

  async listReviewQueue(viewer: AuthenticatedUser, filters: ComplaintQueueFilters) {
    assertComplaintReviewPermissions(viewer);

    const paginationOptions = getPaginationOptions(filters);
    const [complaints, totalItems] = await Promise.all([
      complaintsRepository.listReviewQueue(filters, paginationOptions),
      complaintsRepository.countReviewQueue(filters),
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
