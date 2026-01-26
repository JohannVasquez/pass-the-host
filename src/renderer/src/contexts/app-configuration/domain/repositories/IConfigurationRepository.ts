/**
 * Configuration Repository interface
 * Defines operations for managing application configuration
 */
export interface IConfigurationRepository {
  /**
   * Loads the complete configuration
   */
  loadConfig(): Promise<any>;

  /**
   * Saves username configuration
   */
  saveUsername(username: string): Promise<boolean>;

  /**
   * Saves language configuration
   */
  saveLanguage(language: string): Promise<boolean>;

  /**
   * Saves RAM configuration
   */
  saveRamConfig(minRam: number, maxRam: number): Promise<boolean>;
}
