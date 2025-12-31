/**
 * Use case interface for creating server lock file
 */
export interface ICreateServerLockUseCase {
  /**
   * Creates a server.lock file with username, date and time
   * @param serverId Server identifier
   * @param username Username of who is starting the server
   * @returns Promise with boolean indicating success
   */
  execute(serverId: string, username: string): Promise<boolean>;
}
