import { ServerProcess } from "../entities/ServerProcess";
import { ServerRuntimeConfig, ForgeJvmArgs } from "../entities/ServerRuntimeConfig";

export interface IServerProcessRepository {
  /**
   * Spawns a new Minecraft server process
   * @param serverId Unique identifier for the server
   * @param config Runtime configuration (command, args, workingDir)
   * @param onStdout Callback for stdout data
   * @param onStderr Callback for stderr data
   * @param onClose Callback when process closes
   * @returns ServerProcess entity or null if failed
   */
  spawnProcess(
    serverId: string,
    config: ServerRuntimeConfig,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
    onClose?: (code: number | null) => void,
  ): Promise<ServerProcess>;

  /**
   * Gets a running server process by ID
   * @param serverId Server identifier
   * @returns ServerProcess entity or null if not found
   */
  getProcess(serverId: string): ServerProcess | null;

  /**
   * Sends a command to a running server process
   * @param serverId Server identifier
   * @param command Command to send
   * @returns true if command was sent successfully
   */
  sendCommand(serverId: string, command: string): Promise<boolean>;

  /**
   * Stops a running server process
   * @param serverId Server identifier
   * @returns true if server was stopped successfully
   */
  killProcess(serverId: string): Promise<boolean>;

  /**
   * Reads Forge JVM arguments from run script
   * @param serverId Server identifier
   * @returns ForgeJvmArgs object or null if not found
   */
  readForgeJvmArgs(serverId: string): Promise<ForgeJvmArgs | null>;

  /**
   * Edits Forge user_jvm_args.txt to update RAM settings
   * @param serverId Server identifier
   * @param minRam Minimum RAM in GB
   * @param maxRam Maximum RAM in GB
   * @returns true if file was edited successfully
   */
  editForgeJvmArgs(serverId: string, minRam: number, maxRam: number): Promise<boolean>;

  /**
   * Opens the server folder in the system file explorer
   * @param serverId Server identifier
   * @returns true if folder was opened successfully
   */
  openServerFolder(serverId: string): Promise<boolean>;
}
