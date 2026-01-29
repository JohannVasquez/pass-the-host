import { injectable } from "inversify";
import type { IConfigurationRepository } from "@app-configuration/domain/repositories";
import type { AppConfig } from "@app-configuration/domain/entities";

/**
 * Configuration Repository implementation using IPC
 * Communicates with the main process for configuration operations
 */
@injectable()
export class ConfigurationRepository implements IConfigurationRepository {
  async loadConfig(): Promise<AppConfig | null> {
    return await window.configAPI.loadConfig();
  }

  async saveUsername(username: string): Promise<boolean> {
    return await window.configAPI.saveUsername(username);
  }

  async saveLanguage(language: string): Promise<boolean> {
    return await window.configAPI.saveLanguage(language);
  }

  async saveRamConfig(minRam: number, maxRam: number): Promise<boolean> {
    return await window.configAPI.saveRamConfig(minRam, maxRam);
  }
}
