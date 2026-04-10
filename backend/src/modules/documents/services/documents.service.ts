import { promises as fs } from "fs";
import path from "path";

import { DocumentCategory, RoleCode } from "@prisma/client";

import { uploadsRoot } from "../../../config/uploads";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { hasAnyRole } from "../../../utils/role-checks";
import { documentsRepository } from "../repositories/documents.repository";

const documentCategoryAccess: Record<DocumentCategory, RoleCode[]> = {
  [DocumentCategory.PAYMENT_PROOF]: [RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER],
  [DocumentCategory.SUPPORTING_DOCUMENT]: [
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ],
  [DocumentCategory.COMPLAINT_EVIDENCE]: [
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.COMPLAINT_REVIEW_AUTHORITY,
  ],
};

function assertDocumentAccess(actor: AuthenticatedUser, category: DocumentCategory) {
  if (!hasAnyRole(actor.roles, documentCategoryAccess[category])) {
    throw new AppError(403, "You are not allowed to open this protected document.");
  }
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

    assertDocumentAccess(actor, document.category);

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
