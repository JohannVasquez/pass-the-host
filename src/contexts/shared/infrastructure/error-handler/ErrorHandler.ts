import { CustomError } from "@shared/domain/errors";
import { logger } from "../logger";

/**
 * Error handler utility for consistent error handling across the application
 */
export class ErrorHandler {
  /**
   * Handles an error by logging it appropriately and optionally re-throwing
   * @param error - The error to handle
   * @param context - Context information for logging (e.g., "ServerLockRepository.createLock")
   * @param rethrow - Whether to re-throw the error after logging (default: true)
   */
  static handle(error: unknown, context: string, rethrow: boolean = true): void {
    if (error instanceof CustomError) {
      // Expected errors - log as warnings
      logger.warn(`[${context}] ${error.code}: ${error.message}`, {
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack,
      });
    } else if (error instanceof Error) {
      // Unexpected errors - log as errors
      logger.error(`[${context}] Unexpected error: ${error.message}`, {
        name: error.name,
        stack: error.stack,
      });
    } else {
      // Unknown errors
      logger.error(`[${context}] Unknown error:`, error);
    }

    if (rethrow) {
      throw error;
    }
  }

  /**
   * Wraps an async function with error handling
   * @param fn - The async function to wrap
   * @param context - Context information for logging
   * @returns A wrapped function that handles errors
   */
  static wrapAsync<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context: string,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        ErrorHandler.handle(error, context, true);
        throw error; // TypeScript needs this for type safety
      }
    };
  }

  /**
   * Serializes an error for IPC transmission
   * @param error - The error to serialize
   * @returns A plain object representation of the error
   */
  static serialize(error: unknown): {
    message: string;
    code?: string;
    statusCode?: number;
    isOperational?: boolean;
    name: string;
    stack?: string;
  } {
    if (error instanceof CustomError) {
      return {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        name: error.name,
        stack: error.stack,
      };
    } else if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    } else {
      return {
        message: String(error),
        name: "UnknownError",
      };
    }
  }

  /**
   * Deserializes an error received from IPC
   * Note: This returns a generic Error since CustomError is abstract
   * @param serialized - The serialized error object
   * @returns A reconstructed Error
   */
  static deserialize(serialized: {
    message: string;
    code?: string;
    statusCode?: number;
    isOperational?: boolean;
    name: string;
    stack?: string;
  }): Error {
    const error = new Error(serialized.message);
    error.name = serialized.name;
    error.stack = serialized.stack;
    return error;
  }
}
