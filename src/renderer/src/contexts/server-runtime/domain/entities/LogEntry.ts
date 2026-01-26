/**
 * Log entry entity
 */
export interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "warning" | "error" | "success";
}

/**
 * Type for log entry type
 */
export type LogType = "info" | "warning" | "error" | "success";
