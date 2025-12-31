/**
 * Use case interface for downloading server files from R2
 */
export interface IDownloadServerUseCase {
  /**
   * Downloads server files from R2 to local directory
   * Deletes existing files before downloading to avoid outdated files
   * @param serverId Server identifier
   * @returns Promise with boolean indicating success
   */
  execute(serverId: string): Promise<boolean>;
}
