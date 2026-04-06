import { Prisma, PublicSummaryStatus } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
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
  listPublishedSummaries(filters: PublicSummaryFilters, db: DbClient = prisma) {
    return db.publicSummarySnapshot.findMany({
      where: buildPublishedSummaryWhere(filters),
      include: publicSummaryDetailInclude,
      orderBy: {
        publishedAt: "desc",
      },
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
      orderBy: {
        publishedAt: "desc",
      },
    });
  },

  findPublishedSummaryByReportId(reconciliationReportId: string, db: DbClient = prisma) {
    return db.publicSummarySnapshot.findFirst({
      where: {
        reconciliationReportId,
        status: PublicSummaryStatus.PUBLISHED,
      },
      include: publicSummaryDetailInclude,
      orderBy: {
        publishedAt: "desc",
      },
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
