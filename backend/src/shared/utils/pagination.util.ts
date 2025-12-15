import { PaginatedResponse, PaginationParams } from '../types';

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  const page = params.page || 1;
  const limit = params.limit || 10;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
  };
}

export function getSkip(params: PaginationParams): number {
  const page = params.page || 1;
  const limit = params.limit || 10;
  return (page - 1) * limit;
}

export function getTake(params: PaginationParams): number {
  return params.limit || 10;
}

