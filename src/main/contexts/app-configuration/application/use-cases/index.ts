import { IAppConfigurationRepository } from "@main/contexts/app-configuration/domain/repositories";
import {
  S3Config,
  AppConfig,
  ConfigSaveResult,
} from "@main/contexts/app-configuration/domain/entities";

export class LoadConfigUseCase {
  constructor(private repository: IAppConfigurationRepository) {}

  async execute(): Promise<AppConfig | null> {
    return this.repository.loadConfig();
  }
}

export class SaveS3ConfigUseCase {
  constructor(private repository: IAppConfigurationRepository) {}

  async execute(s3Config: S3Config): Promise<ConfigSaveResult> {
    return this.repository.saveS3Config(s3Config);
  }
}

export class SaveCloudSyncEnabledUseCase {
  constructor(private repository: IAppConfigurationRepository) {}

  async execute(enabled: boolean): Promise<ConfigSaveResult> {
    return this.repository.saveCloudSyncEnabled(enabled);
  }
}

export class SaveUsernameUseCase {
  constructor(private repository: IAppConfigurationRepository) {}

  async execute(username: string): Promise<ConfigSaveResult> {
    return this.repository.saveUsername(username);
  }
}

export class SaveRamConfigUseCase {
  constructor(private repository: IAppConfigurationRepository) {}

  async execute(minRam: number, maxRam: number): Promise<ConfigSaveResult> {
    return this.repository.saveRamConfig(minRam, maxRam);
  }
}

export class SaveLanguageUseCase {
  constructor(private repository: IAppConfigurationRepository) {}

  async execute(language: string): Promise<ConfigSaveResult> {
    return this.repository.saveLanguage(language);
  }
}
