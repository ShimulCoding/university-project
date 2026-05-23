import { promises as fs } from "fs";
import path from "path";

import { DocumentCategory, RoleCode } from "@prisma/client";

import { uploadsRoot } from "../../../config/uploads";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { hasEventScopedRole, isSystemAdmin } from "../../../utils/event-scope";
import { documentsRepository } from "../repositories/documents.repository";

/** Roles allowed to open each document category (used for event-scoped checks) */
const documentCategoryRoles: Record<DocumentCategory, RoleCode[]> = {
  [DocumentCategory.PAYMENT_PROOF]: [
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
  ],
  [DocumentCategory.SUPPORTING_DOCUMENT]: [
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
    RoleCode.COMPLAINT_REVIEW_AUTHORITY,
  ],
  [DocumentCategory.COMPLAINT_EVIDENCE]: [
    RoleCode.SYSTEM_ADMIN,
    RoleCode.EVENT_ADMIN,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.COMPLAINT_REVIEW_AUTHORITY,
  ],
};

type DocumentWithParents = NonNullable<Awaited<ReturnType<typeof documentsRepository.findById>>>;

/**
 * Resolve the eventId that owns this document by traversing its parent entities.
 * Returns undefined if the document is not associated with any event.
 */
function resolveDocumentEventId(document: DocumentWithParents): string | undefined {
  if (document.paymentProof?.registration?.eventId) {
    return document.paymentProof.registration.eventId;
  }
  if (document.incomeRecord?.eventId) return document.incomeRecord.eventId;
  if (document.budgetRequest?.eventId) return document.budgetRequest.eventId;
  if (document.expenseRequest?.eventId) return document.expenseRequest.eventId;
  if (document.expenseRecord?.eventId) return document.expenseRecord.eventId;
  if (document.complaint?.eventId) return document.complaint.eventId;
  return undefined;
}

/**
 * Assert that the actor can access this document.
 *
 * Access is granted when:
 *   1. The actor uploaded the document themselves, OR
 *   2. The actor is a SYSTEM_ADMIN, OR
 *   3. The document belongs to an event AND the actor holds an allowed
 *      event-scoped role for that event.
 *
 * This prevents cross-event document access — e.g. a Finance Controller
 * assigned to Event A cannot open payment proofs from Event B.
 */
function assertDocumentAccess(
  actor: AuthenticatedUser,
  document: DocumentWithParents,
) {
  // Uploader can always access their own documents
  if (document.uploadedById === actor.id) {
    return;
  }

  // System admin has global access
  if (isSystemAdmin(actor)) {
    return;
  }

  // Resolve which event this document belongs to
  const eventId = resolveDocumentEventId(document);

  if (eventId) {
    // Event-scoped check: actor must hold an allowed role for THIS event
    const allowedRoles = documentCategoryRoles[document.category];
    if (hasEventScopedRole(actor, eventId, allowedRoles)) {
      return;
    }
  }

  // No access path matched
  throw new AppError(403, "You are not allowed to open this protected document.");
}

function resolveDocumentPath(relativePath: string) {
  const absolutePath = path.resolve(uploadsRoot, relativePath);
  const relativeFromRoot = path.relative(uploadsRoot, absolutePath);

  if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    throw new AppError(500, "The stored document path is invalid.");
  }

  return absolutePath;
}

export const documentsService = {
  async getProtectedDocument(actor: AuthenticatedUser, documentId: string) {
    const document = await documentsRepository.findById(documentId);

    if (!document) {
      throw new AppError(404, "Protected document not found.");
    }

    assertDocumentAccess(actor, document);

    const absolutePath = resolveDocumentPath(document.relativePath);

    try {
      await fs.access(absolutePath);
    } catch {
      throw new AppError(404, "Protected document file is unavailable.");
    }

    return {
      absolutePath,
      originalName: document.originalName,
      mimeType: document.mimeType,
    };
  },
};
