import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const tenantId = request.headers['x-tenant-id'] || 'N/A';

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const contentLength = response.get('content-length');
          const duration = Date.now() - startTime;

          this.logger.log(
            `${method} ${url} ${statusCode} ${contentLength || 0}b - ${duration}ms - ${ip} - ${userAgent} - Tenant: ${tenantId}`,
          );
        },
        error: (error) => {
          const { statusCode } = response;
          const duration = Date.now() - startTime;

          this.logger.error(
            `${method} ${url} ${statusCode || 500} - ${duration}ms - ${ip} - ${userAgent} - Tenant: ${tenantId} - Error: ${error.message}`,
          );
        },
      }),
    );
  }
}