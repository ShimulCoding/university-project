import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";

export const documentsRepository = {
  findById(documentId: string, db: DbClient = prisma) {
    return db.supportingDocument.findUnique({
      where: {
        id: documentId,
      },
      select: {
        id: true,
        category: true,
        originalName: true,
        mimeType: true,
        relativePath: true,
        uploadedById: true,
        // Include parent entity references to resolve event ownership
        paymentProof: {
          select: {
            registration: {
              select: { eventId: true },
            },
          },
        },
        incomeRecord: { select: { eventId: true } },
        budgetRequest: { select: { eventId: true } },
        expenseRequest: { select: { eventId: true } },
        expenseRecord: { select: { eventId: true } },
        complaint: { select: { eventId: true } },
      },
    });
  },
};
