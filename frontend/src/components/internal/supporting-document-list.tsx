import { ExternalLink, FileText } from "lucide-react";

import type { SupportingDocumentSummary } from "@/types";
import { buildApiUrl } from "@/lib/api/shared";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="break-all">{document.originalName}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="neutral">{document.category.replaceAll("_", " ")}</Badge>
                    <Badge variant="info">{document.mimeType}</Badge>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={buildApiUrl(document.viewPath)} target="_blank" rel="noreferrer">
                    Open file
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                {formatFileSize(document.sizeBytes)} / {formatDateTime(document.createdAt)}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
