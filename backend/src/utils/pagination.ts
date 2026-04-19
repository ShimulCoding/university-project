export type PaginationInput = {
  page?: number | undefined;
  pageSize?: number | undefined;
};

export type PaginationOptions = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PaginationResult = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

function toPositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isInteger(value) || !value || value < 1) {
    return fallback;
  }

  return value;
}

export function getPaginationOptions(input: PaginationInput = {}): PaginationOptions {
  const page = toPositiveInteger(input.page, defaultPage);
  const requestedPageSize = toPositiveInteger(input.pageSize, defaultPageSize);
  const pageSize = Math.min(requestedPageSize, maxPageSize);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginationResult(
  options: PaginationOptions,
  totalItems: number,
): PaginationResult {
  const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));

  return {
    page: options.page,
    pageSize: options.pageSize,
    totalItems,
    totalPages,
    hasNextPage: options.page < totalPages,
    hasPreviousPage: options.page > 1,
  };
}
