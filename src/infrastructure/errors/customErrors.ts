// src-refactored/infrastructure/errors/customErrors.ts

/**
 * Base class for all custom application errors.
 * Allows for easy identification of known error types.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, statusCode: number, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when a resource is not found.
 * Corresponds to a 404 Not Found HTTP status.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', context?: Record<string, unknown>) {
    super(message, 404, context);
  }
}

/**
 * Thrown when input validation fails.
 * Corresponds to a 400 Bad Request HTTP status.
 */
export class ValidationError extends AppError {
  constructor(message = 'Invalid input provided', context?: Record<string, unknown>) {
    super(message, 400, context);
  }
}

/**
 * Thrown when a user is not authorized to perform an action.
 * Corresponds to a 403 Forbidden HTTP status.
 */
export class AuthorizationError extends AppError {
  constructor(message = 'You are not authorized to perform this action', context?: Record<string, unknown>) {
    super(message, 403, context);
  }
}

/**
 * Thrown when a user is not authenticated.
 * Corresponds to a 401 Unauthorized HTTP status.
 */
export class AuthenticationError extends AppError {
  constructor(message = 'You must be logged in to perform this action', context?: Record<string, unknown>) {
    super(message, 401, context);
  }
}

/**
 * Thrown for configuration-related errors.
 * Corresponds to a 500 Internal Server Error HTTP status.
 */
export class ConfigurationError extends AppError {
    constructor(message = 'Internal server configuration error', context?: Record<string, unknown>) {
      super(message, 500, context);
    }
}
