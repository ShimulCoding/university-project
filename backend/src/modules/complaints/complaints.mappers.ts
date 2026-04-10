import { ComplaintState, Prisma } from "@prisma/client";

const actorSummarySelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  fullName: true,
  email: true,
});

const roleSummarySelect = Prisma.validator<Prisma.RoleSelect>()({
  id: true,
  code: true,
  name: true,
});

const safeEvidenceSelect = Prisma.validator<Prisma.SupportingDocumentSelect>()({
  id: true,
  category: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
});

export const complaintDetailInclude = Prisma.validator<Prisma.ComplaintInclude>()({
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  },
  submittedBy: {
    select: actorSummarySelect,
  },
  documents: {
    select: safeEvidenceSelect,
  },
  routings: {
    include: {
      fromRole: {
        select: roleSummarySelect,
      },
      toRole: {
        select: roleSummarySelect,
      },
      routedBy: {
        select: actorSummarySelect,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
});

export type ComplaintWithContext = Prisma.ComplaintGetPayload<{
  include: typeof complaintDetailInclude;
}>;

function mapEventSummary(event: ComplaintWithContext["event"]) {
  return event
    ? {
        id: event.id,
        title: event.title,
        slug: event.slug,
        status: event.status,
      }
    : null;
}

function mapSubmitterSummary(submittedBy: ComplaintWithContext["submittedBy"]) {
  return submittedBy
    ? {
        id: submittedBy.id,
        fullName: submittedBy.fullName,
        email: submittedBy.email,
      }
    : null;
}

function mapEvidence(document: ComplaintWithContext["documents"][number]) {
  return {
    id: document.id,
    category: document.category,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: Number(document.sizeBytes),
    createdAt: document.createdAt,
    viewPath: `/documents/${document.id}/open`,
  };
}

function mapRoutingSummary(routing: ComplaintWithContext["routings"][number], includeNote: boolean) {
  return {
    id: routing.id,
    state: routing.state,
    createdAt: routing.createdAt,
    note: includeNote ? routing.note ?? null : null,
    fromRole: routing.fromRole
      ? {
          id: routing.fromRole.id,
          code: routing.fromRole.code,
          name: routing.fromRole.name,
        }
      : null,
    toRole: routing.toRole
      ? {
          id: routing.toRole.id,
          code: routing.toRole.code,
          name: routing.toRole.name,
        }
      : null,
    routedBy: routing.routedBy
      ? {
          id: routing.routedBy.id,
          fullName: routing.routedBy.fullName,
          email: routing.routedBy.email,
        }
      : null,
  };
}

function buildSharedComplaintShape(complaint: ComplaintWithContext) {
  return {
    id: complaint.id,
    subject: complaint.subject,
    description: complaint.description,
    state: complaint.state,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    event: mapEventSummary(complaint.event),
    evidence: complaint.documents.map(mapEvidence),
  };
}

export function mapComplaintForSubmitter(complaint: ComplaintWithContext) {
  return {
    ...buildSharedComplaintShape(complaint),
    submittedBy: mapSubmitterSummary(complaint.submittedBy),
    routingHistory: complaint.routings.map((routing) => mapRoutingSummary(routing, false)),
  };
}

export function mapComplaintForReview(complaint: ComplaintWithContext) {
  return {
    ...buildSharedComplaintShape(complaint),
    submittedBy: mapSubmitterSummary(complaint.submittedBy),
    routingHistory: complaint.routings.map((routing) => mapRoutingSummary(routing, true)),
  };
}

export function mapComplaintQueueItem(complaint: ComplaintWithContext) {
  const lastRouting = complaint.routings.at(-1);

  return {
    id: complaint.id,
    subject: complaint.subject,
    state: complaint.state,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    event: mapEventSummary(complaint.event),
    submittedBy: mapSubmitterSummary(complaint.submittedBy),
    evidenceCount: complaint.documents.length,
    lastRouting: lastRouting ? mapRoutingSummary(lastRouting, true) : null,
    isEscalated: complaint.state === ComplaintState.ESCALATED,
  };
}
