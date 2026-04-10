import { z } from "zod";

export const protectedDocumentParamSchema = z.object({
  params: z.object({
    documentId: z.string().cuid(),
  }),
});
