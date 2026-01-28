/**
 * Base class for application-specific errors
 * These are expected errors that should be logged as warnings
 */
export abstract class CustomError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error - thrown when input data is invalid
 */
export class ValidationError extends CustomError {
  constructor(message: string, code: string = "VALIDATION_ERROR") {
    super(message, code, 400);
  }
}

/**
 * Not found error - thrown when a resource doesn't exist
 */
export class NotFoundError extends CustomError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, "NOT_FOUND", 404);
  }
}

/**
 * Network error - thrown when network operations fail
 */
export class NetworkError extends CustomError {
  constructor(message: string, code: string = "NETWORK_ERROR") {
    super(message, code, 503);
  }
}

/**
 * File system error - thrown when file operations fail
 */
export class FileSystemError extends CustomError {
  constructor(message: string, code: string = "FILESYSTEM_ERROR") {
    super(message, code, 500);
  }
}

/**
 * Configuration error - thrown when configuration is invalid or missing
 */
export class ConfigurationError extends CustomError {
  constructor(message: string, code: string = "CONFIGURATION_ERROR") {
    super(message, code, 500);
  }
}

/**
 * Lock error - thrown when server lock operations fail
 */
export class LockError extends CustomError {
  constructor(message: string, code: string = "LOCK_ERROR") {
    super(message, code, 409);
  }
}

/**
 * Process error - thrown when server process operations fail
 */
export class ProcessError extends CustomError {
  constructor(message: string, code: string = "PROCESS_ERROR") {
    super(message, code, 500);
  }
}

/**
 * External service error - thrown when external services (R2, rclone) fail
 */
export class ExternalServiceError extends CustomError {
  constructor(service: string, message: string, code: string = "EXTERNAL_SERVICE_ERROR") {
    super(`${service}: ${message}`, code, 502);
  }
}
