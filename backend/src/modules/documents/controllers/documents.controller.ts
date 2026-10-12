import type { Request, Response } from "express";

import { documentsService } from "../services/documents.service";
import { getRequestMetadata } from "../../../utils/request-metadata";
import { sendAuthorizedLocalFile } from "../../../utils/file-response";

export const documentsController = {
  async openProtectedDocument(request: Request, response: Response) {
    const document = await documentsService.getProtectedDocument(
      request.auth!.user,
      String(request.params.documentId),
      getRequestMetadata(request),
    );

    response.setHeader("Cache-Control", "private, no-store");
    response.type(document.mimeType);
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(document.originalName)}"`,
    );
    sendAuthorizedLocalFile(response, document.absolutePath);
  },
};
