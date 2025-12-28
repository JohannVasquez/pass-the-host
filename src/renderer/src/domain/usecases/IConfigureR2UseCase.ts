import { R2Config } from "../entities/ServerConfig";

export interface IConfigureR2UseCase {
  execute(config: R2Config): void;
}
