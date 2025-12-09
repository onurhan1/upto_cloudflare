// Global error handling and user-friendly error messages

import { Context } from 'hono';
import { logger } from './logger';
import { Env } from '../types';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public userMessage?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', 'Invalid request data', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource} not found${id ? `: ${id}` : ''}`,
      404,
      'NOT_FOUND',
      `${resource} not found`
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED', 'Authentication required');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN', 'You do not have permission to perform this action');
    this.name = 'ForbiddenError';
  }
}

/**
 * Global error handler middleware
 */
export async function errorHandler(
  error: Error | AppError,
  c: Context<{ Bindings: Env }>
): Promise<Response> {
  const traceId = c.get('traceId') || logger.generateTraceId();
  const requestLogger = logger.withTrace(traceId);

  // Log error
  if (error instanceof AppError) {
    requestLogger.warn('Application error', {
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
    });
  } else {
    requestLogger.error('Unhandled error', error, {
      message: error.message,
      stack: error.stack,
    });
  }

  // Return user-friendly error response
  if (error instanceof AppError) {
    return c.json(
      {
        error: error.userMessage || error.message,
        code: error.code,
        details: error.details,
        traceId,
      },
      error.statusCode
    );
  }

  // Unknown error - return generic message
  return c.json(
    {
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      traceId,
    },
    500
  );
}

/**
 * User-friendly error messages
 */
export const ErrorMessages = {
  SERVICE_NOT_FOUND: 'Service not found',
  INCIDENT_NOT_FOUND: 'Incident not found',
  ORGANIZATION_NOT_FOUND: 'Organization not found',
  PROJECT_NOT_FOUND: 'Project not found',
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to perform this action',
  VALIDATION_ERROR: 'Invalid request data',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
};

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandling<T extends any[]>(
  handler: (c: Context<{ Bindings: Env }>, ...args: T) => Promise<Response>
) {
  return async (c: Context<{ Bindings: Env }>, ...args: T): Promise<Response> => {
    try {
      return await handler(c, ...args);
    } catch (error) {
      return errorHandler(error as Error, c);
    }
  };
}

