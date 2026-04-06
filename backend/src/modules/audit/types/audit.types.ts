export type AuditMetadata = {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  route?: string | undefined;
  method?: string | undefined;
};

export type CreateAuditLogInput = AuditMetadata & {
  actorId?: string | undefined;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string | undefined;
  context?: Record<string, unknown> | undefined;
};

export type AuditFilters = {
  actorId?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  limit: number;
};
