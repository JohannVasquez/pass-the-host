import { IAppConfigurationRepository } from "../../domain/repositories";
import { R2Config, AppConfig, ConfigSaveResult } from "../../domain/entities";

export class LoadConfigUseCase {
  constructor(private repository: IAppConfigurationRepository) {}

  async execute(): Promise<AppConfig | null> {
    return this.repository.loadConfig();
  }
}

export class SaveR2ConfigUseCase {
  constructor(private repository: IAppConfigurationRepository) {}

  async execute(r2Config: R2Config): Promise<ConfigSaveResult> {
    return this.repository.saveR2Config(r2Config);
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
