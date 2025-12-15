import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const Pagination = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginationQuery => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query;

    return {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? Math.min(parseInt(query.limit, 10), 100) : 10,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: (query.sortOrder || 'DESC').toUpperCase() as 'ASC' | 'DESC',
    };
  },
);

