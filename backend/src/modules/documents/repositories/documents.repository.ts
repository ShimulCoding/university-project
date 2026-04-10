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
      },
    });
  },
};
