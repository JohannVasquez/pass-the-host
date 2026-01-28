import log from "electron-log";
import { app } from "electron";
import path from "path";

/**
 * Extended file transport interface with additional properties
 */
interface ExtendedFileTransport {
  level: string | false;
  format?: string;
  maxSize?: number;
  maxFiles?: number;
  resolvePathFn?: () => string;
}

/**
 * Centralized logger configuration for the application
 * Uses electron-log with file rotation settings
 */
class Logger {
  private static instance: Logger;

  private constructor() {
    this.configure();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private configure(): void {
    const fileTransport = log.transports.file as unknown as ExtendedFileTransport;

    // Configure file logging
    fileTransport.level = "info";
    fileTransport.maxSize = 10 * 1024 * 1024; // 10 MB
    fileTransport.maxFiles = 5; // Keep 5 files maximum
    fileTransport.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";

    // Configure console logging (only in development)
    log.transports.console.level = process.env.NODE_ENV === "development" ? "debug" : "info";

    // Set log file location
    const userDataPath = app.getPath("userData");
    const logsPath = path.join(userDataPath, "logs");
    fileTransport.resolvePathFn = () => path.join(logsPath, "main.log");

    log.info("Logger initialized");
    log.info(`Log file location: ${logsPath}`);
  }

  public info(message: string, ...args: unknown[]): void {
    log.info(message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    log.error(message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    log.warn(message, ...args);
  }

  public debug(message: string, ...args: unknown[]): void {
    log.debug(message, ...args);
  }

  public verbose(message: string, ...args: unknown[]): void {
    log.verbose(message, ...args);
  }

  /**
   * Get the raw electron-log instance for advanced usage
   */
  public getLog(): typeof log {
    return log;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
export default logger;
