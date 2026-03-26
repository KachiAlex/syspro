import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Validates request body against a Zod schema.
 * Returns error response if validation fails.
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ valid: true; data: T } | { valid: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        valid: false,
        response: NextResponse.json(
          {
            error: 'Invalid request body',
            details: result.error.errors.map(e => ({
              field: e.path.join('.') || 'root',
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      };
    }

    return { valid: true, data: result.data as T };
  } catch (e) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validates query parameters against a Zod schema.
 * Returns error response if validation fails.
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): { valid: true; data: T } | { valid: false; response: NextResponse } {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: result.error.errors.map(e => ({
            field: e.path.join('.') || 'root',
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { valid: true, data: result.data as T };
}

/**
 * Generic error response for API routes.
 */
export function apiError(message: string, statusCode: number = 500, details?: unknown): NextResponse {
  const response: any = {
    error: message,
  };
  
  if (process.env.NODE_ENV === 'development' && details) {
    response.details = details;
  }
  
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Generic success response for API routes.
 */
export function apiSuccess<T>(data: T, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, { headers });
}
