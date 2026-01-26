import { injectable } from 'inversify'
import type { IServerRuntimeRepository } from '@server-runtime/domain/repositories/IServerRuntimeRepository'
import type { ServerStatus } from '@server-runtime/domain/entities/ServerStatus'
import type { LogEntry } from '@server-runtime/domain/entities/LogEntry'
import { eventBus, ServerLogReceivedEvent } from '@shared/index'

/**
 * Server Runtime Repository implementation using Electron IPC
 */
@injectable()
export class ServerRuntimeRepository implements IServerRuntimeRepository {
  private logCallbacks: Array<(log: LogEntry) => void> = []
  private statusCallbacks: Array<(status: ServerStatus) => void> = []

  constructor() {
    this.setupEventListeners()
  }

  /**
   * Setup IPC event listeners
   */
  private setupEventListeners(): void {
    // Listen for server logs
    if ((window as any).serverAPI?.onServerLog) {
      ;(window as any).serverAPI.onServerLog((log: LogEntry) => {
        // Publish to event bus
        eventBus.publish(new ServerLogReceivedEvent('current', log.message, log.type))

        // Notify local callbacks
        this.logCallbacks.forEach((callback) => callback(log))
      })
    }

    // Listen for status changes
    if ((window as any).serverAPI?.onStatusChange) {
      ;(window as any).serverAPI.onStatusChange((status: ServerStatus) => {
        this.statusCallbacks.forEach((callback) => callback(status))
      })
    }
  }

  async startServer(serverId: string): Promise<void> {
    try {
      await (window as any).serverAPI.startServer(serverId)
    } catch (error) {
      console.error(`Error starting server ${serverId}:`, error)
      throw error
    }
  }

  async stopServer(serverId: string): Promise<void> {
    try {
      await (window as any).serverAPI.stopServer(serverId)
    } catch (error) {
      console.error(`Error stopping server ${serverId}:`, error)
      throw error
    }
  }

  async executeCommand(serverId: string, command: string): Promise<void> {
    try {
      await (window as any).serverAPI.sendCommand(serverId, command)
    } catch (error) {
      console.error(`Error executing command on ${serverId}:`, error)
      throw error
    }
  }

  async getServerStatus(serverId: string): Promise<ServerStatus> {
    try {
      const status = await (window as any).serverAPI.getStatus(serverId)
      return status
    } catch (error) {
      console.error(`Error getting status for ${serverId}:`, error)
      throw error
    }
  }

  onLogReceived(callback: (log: LogEntry) => void): () => void {
    this.logCallbacks.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.logCallbacks.indexOf(callback)
      if (index > -1) {
        this.logCallbacks.splice(index, 1)
      }
    }
  }

  onStatusChanged(callback: (status: ServerStatus) => void): () => void {
    this.statusCallbacks.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback)
      if (index > -1) {
        this.statusCallbacks.splice(index, 1)
      }
    }
  }
}
