import { injectable } from "inversify";
import { IServerLifecycleRepository } from "@main/contexts/server-lifecycle/domain/repositories";
import {
  LocalServerInfo,
  MinecraftServerConfig,
  ServerCreationResult,
  ServerDeletionResult,
} from "@main/contexts/server-lifecycle/domain/entities";

@injectable()
export class CreateMinecraftServerUseCase {
  constructor(private serverLifecycleRepository: IServerLifecycleRepository) {}

  async execute(
    config: MinecraftServerConfig,
    onProgress?: (message: string) => void,
  ): Promise<ServerCreationResult> {
    return await this.serverLifecycleRepository.createServer(config, onProgress);
  }
}

@injectable()
export class DeleteServerLocallyUseCase {
  constructor(private serverLifecycleRepository: IServerLifecycleRepository) {}

  execute(serverId: string): ServerDeletionResult {
    return this.serverLifecycleRepository.deleteServerLocally(serverId);
  }
}

@injectable()
export class ListLocalServersUseCase {
  constructor(private serverLifecycleRepository: IServerLifecycleRepository) {}

  execute(): LocalServerInfo[] {
    return this.serverLifecycleRepository.listLocalServers();
  }
}

@injectable()
export class GetLocalServerPathUseCase {
  constructor(private serverLifecycleRepository: IServerLifecycleRepository) {}

  execute(serverId: string): string {
    return this.serverLifecycleRepository.getLocalServerPath(serverId);
  }
}
