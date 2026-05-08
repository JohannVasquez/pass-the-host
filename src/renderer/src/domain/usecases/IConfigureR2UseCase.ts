import { R2Config } from "@renderer/domain/entities/ServerConfig";

export interface IConfigureR2UseCase {
  execute(config: R2Config): void;
}
