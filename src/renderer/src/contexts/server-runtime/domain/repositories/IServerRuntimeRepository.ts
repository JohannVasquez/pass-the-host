import type { ServerStatus } from '../entities/ServerStatus'
import type { LogEntry } from '../entities/LogEntry'

/**
 * Server Runtime Repository interface
 * Defines operations for server process management
 */
export interface IServerRuntimeRepository {
  /**
   * Starts the server
   * @param serverId Server ID to start
   * @returns Promise that resolves when server starts
   */
  startServer(serverId: string): Promise<void>

  /**
   * Stops the server
   * @param serverId Server ID to stop
   * @returns Promise that resolves when server stops
   */
  stopServer(serverId: string): Promise<void>

  /**
   * Executes a command on the running server
   * @param serverId Server ID
   * @param command Command to execute
   * @returns Promise that resolves when command is sent
   */
  executeCommand(serverId: string, command: string): Promise<void>

  /**
   * Gets the current server status
   * @param serverId Server ID
   * @returns Promise with server status
   */
  getServerStatus(serverId: string): Promise<ServerStatus>

  /**
   * Subscribes to server log events
   * @param callback Callback function to receive log entries
   * @returns Unsubscribe function
   */
  onLogReceived(callback: (log: LogEntry) => void): () => void

  /**
   * Subscribes to server status changes
   * @param callback Callback function to receive status updates
   * @returns Unsubscribe function
   */
  onStatusChanged(callback: (status: ServerStatus) => void): () => void
}
