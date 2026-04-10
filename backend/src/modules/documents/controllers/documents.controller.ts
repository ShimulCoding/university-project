import type { Request, Response } from "express";

import { documentsService } from "../services/documents.service";

export const documentsController = {
  async openProtectedDocument(request: Request, response: Response) {
    const document = await documentsService.getProtectedDocument(
      request.auth!.user,
      String(request.params.documentId),
    );

    response.type(document.mimeType);
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(document.originalName)}"`,
    );
    response.sendFile(document.absolutePath);
  },
};
