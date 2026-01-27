import { R2Config, AppConfig, ConfigSaveResult } from "../entities";

export interface IAppConfigurationRepository {
  loadConfig(): Promise<AppConfig | null>;
  saveR2Config(r2Config: R2Config): Promise<ConfigSaveResult>;
  saveUsername(username: string): Promise<ConfigSaveResult>;
  saveRamConfig(minRam: number, maxRam: number): Promise<ConfigSaveResult>;
  saveLanguage(language: string): Promise<ConfigSaveResult>;
}
