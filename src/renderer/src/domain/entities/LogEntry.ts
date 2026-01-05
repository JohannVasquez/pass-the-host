export interface LogEntry {
  timestamp: Date;
  message: string;
  type: "info" | "warning" | "error" | "success";
}
