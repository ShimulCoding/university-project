import { FileText } from "lucide-react";

import type { SupportingDocumentSummary } from "@/types";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SupportingDocumentList({
  documents,
  title = "Supporting documents",
  emptyMessage = "No protected documents are linked to this record yet.",
}: {
  documents: SupportingDocumentSummary[];
  title?: string;
  emptyMessage?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {documents.length === 0 ? (
          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          documents.map((document) => (
            <div
              key={document.id}
              className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                {document.originalName}
              </div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                {document.mimeType} / {document.sizeBytes} bytes /{" "}
                {formatDateTime(document.createdAt)}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
