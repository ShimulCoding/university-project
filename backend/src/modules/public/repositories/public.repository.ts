import { Prisma, PublicSummaryStatus } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { PaginationOptions } from "../../../utils/pagination";
import { publicSummaryDetailInclude } from "../public.mappers";
import type { PublicFinancialSummaryPayload, PublicSummaryFilters } from "../types/public.types";

type CreatePublicSummarySnapshotData = {
  eventId: string;
  reconciliationReportId: string;
  publishedById: string;
  totalCollected: string;
  totalSpent: string;
  closingBalance: string;
  payload: PublicFinancialSummaryPayload;
};

function buildPublishedSummaryWhere(
  filters: PublicSummaryFilters,
): Prisma.PublicSummarySnapshotWhereInput {
  const where: Prisma.PublicSummarySnapshotWhereInput = {
    status: PublicSummaryStatus.PUBLISHED,
  };

  const trimmedSearch = filters.search?.trim();

  if (trimmedSearch) {
    where.event = {
      OR: [
        {
          title: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
      ],
    };
  }

  return where;
}

export const publicRepository = {
  async listLatestPublishedSummaries(filters: PublicSummaryFilters, pagination: PaginationOptions, db: DbClient = prisma) {
    const ids = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT s."id" FROM "PublicSummarySnapshot" s JOIN "Event" e ON e."id" = s."eventId"
      WHERE ${latestPublishedWhere(filters)}
      ORDER BY s."publishedAt" DESC NULLS LAST, s."id" DESC OFFSET ${pagination.skip} LIMIT ${pagination.take}
    `);
    const records = await db.publicSummarySnapshot.findMany({ where: { id: { in: ids.map((row) => row.id) } }, include: publicSummaryDetailInclude });
    const byId = new Map(records.map((record) => [record.id, record]));
    return ids.map((row) => byId.get(row.id)!);
  },

  async countLatestPublishedSummaries(filters: PublicSummaryFilters, db: DbClient = prisma) {
    const [row] = await db.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS total FROM "PublicSummarySnapshot" s JOIN "Event" e ON e."id" = s."eventId"
      WHERE ${latestPublishedWhere(filters)}
    `);
    return Number(row?.total ?? 0);
  },
  listPublishedSummaries(
    filters: PublicSummaryFilters,
    pagination?: PaginationOptions,
    db: DbClient = prisma,
  ) {
    return db.publicSummarySnapshot.findMany({
      where: buildPublishedSummaryWhere(filters),
      include: publicSummaryDetailInclude,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    });
  },

  countPublishedSummaries(filters: PublicSummaryFilters, db: DbClient = prisma) {
    return db.publicSummarySnapshot.count({
      where: buildPublishedSummaryWhere(filters),
    });
  },

  findSummaryById(publicSummaryId: string, db: DbClient = prisma) {
    return db.publicSummarySnapshot.findUnique({
      where: { id: publicSummaryId },
      include: publicSummaryDetailInclude,
    });
  },

  findPublishedSummaryByEventLookup(lookupKey: string, db: DbClient = prisma) {
    return db.publicSummarySnapshot.findFirst({
      where: {
        status: PublicSummaryStatus.PUBLISHED,
        event: {
          OR: [{ id: lookupKey }, { slug: lookupKey }],
        },
      },
      include: publicSummaryDetailInclude,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    });
  },

  findPublishedSummaryByReportId(reconciliationReportId: string, db: DbClient = prisma) {
    return db.publicSummarySnapshot.findFirst({
      where: {
        reconciliationReportId,
        status: PublicSummaryStatus.PUBLISHED,
      },
      include: publicSummaryDetailInclude,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    });
  },

  unpublishSummary(publicSummaryId: string, db: DbClient = prisma) {
    return db.publicSummarySnapshot.update({
      where: { id: publicSummaryId },
      data: {
        status: PublicSummaryStatus.DRAFT,
      },
      include: publicSummaryDetailInclude,
    });
  },

  createPublishedSummary(data: CreatePublicSummarySnapshotData, db: DbClient = prisma) {
    return db.publicSummarySnapshot.create({
      data: {
        eventId: data.eventId,
        reconciliationReportId: data.reconciliationReportId,
        status: PublicSummaryStatus.PUBLISHED,
        publishedById: data.publishedById,
        publishedAt: new Date(),
        totalCollected: data.totalCollected,
        totalSpent: data.totalSpent,
        closingBalance: data.closingBalance,
        payload: data.payload as unknown as Prisma.InputJsonValue,
      },
      include: publicSummaryDetailInclude,
    });
  },
};

function latestPublishedWhere(filters: PublicSummaryFilters) {
  const search = filters.search?.trim();
  const pattern = `%${(search ?? "").replace(/[\\%_]/g, "\\$&")}%`;
  return Prisma.sql`s."status" = 'PUBLISHED'
    AND NOT EXISTS (
      SELECT 1 FROM "PublicSummarySnapshot" newer
      WHERE newer."eventId" = s."eventId" AND newer."status" = 'PUBLISHED'
        AND (COALESCE(newer."publishedAt", '-infinity'::timestamp), newer."id") > (COALESCE(s."publishedAt", '-infinity'::timestamp), s."id")
    )
    AND (${!search} OR e."title" ILIKE ${pattern} OR e."slug" ILIKE ${pattern})`;
}
