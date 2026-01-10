import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse, ValidationError } from '../types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let errors: ValidationError[] | undefined;
    let debugData: Record<string, any> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        
        // Handle validation errors
        if (Array.isArray(responseObj.message)) {
          errors = responseObj.message.map((msg: string) => ({
            field: 'unknown',
            message: msg,
            code: 'VALIDATION_ERROR',
          }));
          message = 'Validation failed';
        }
      } else {
        message = exceptionResponse as string;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      
      // Log unexpected errors
      this.logger.error(
        `Unexpected error: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );

      if (exception instanceof Error) {
        debugData = {
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
        };
      } else {
        debugData = {
          value: exception,
        };
      }
    }

    if (!debugData && exception instanceof Error) {
      debugData = {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
      };
    }

    const errorResponse: ApiResponse & { error?: Record<string, any> } = {
      success: false,
      message,
      errors,
      error: debugData,
    };

    // Log error details
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }
}