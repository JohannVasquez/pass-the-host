import { injectable } from "inversify";
import type { IConfigurationRepository } from "../../domain/repositories";

/**
 * Configuration Repository implementation using IPC
 * Communicates with the main process for configuration operations
 */
@injectable()
export class ConfigurationRepository implements IConfigurationRepository {
  async loadConfig(): Promise<any> {
    try {
      return await window.configAPI.loadConfig();
    } catch (error) {
      console.error("Error loading configuration:", error);
      return null;
    }
  }

  async saveUsername(username: string): Promise<boolean> {
    try {
      return await window.configAPI.saveUsername(username);
    } catch (error) {
      console.error("Error saving username:", error);
      return false;
    }
  }

  async saveLanguage(language: string): Promise<boolean> {
    try {
      return await window.configAPI.saveLanguage(language);
    } catch (error) {
      console.error("Error saving language:", error);
      return false;
    }
  }

  async saveRamConfig(minRam: number, maxRam: number): Promise<boolean> {
    try {
      return await window.configAPI.saveRamConfig(minRam, maxRam);
    } catch (error) {
      console.error("Error saving RAM configuration:", error);
      return false;
    }
  }
}
