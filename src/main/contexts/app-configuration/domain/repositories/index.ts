import { S3Config, AppConfig, ConfigSaveResult } from "../entities";

export interface IAppConfigurationRepository {
  loadConfig(): Promise<AppConfig | null>;
  saveS3Config(s3Config: S3Config): Promise<ConfigSaveResult>;
  saveUsername(username: string): Promise<ConfigSaveResult>;
  saveRamConfig(minRam: number, maxRam: number): Promise<ConfigSaveResult>;
  saveLanguage(language: string): Promise<ConfigSaveResult>;
}
