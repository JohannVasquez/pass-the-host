import { injectable } from "inversify";
import { IServerProcessRepository } from "../../domain/repositories";
import { ServerProcess, ServerRuntimeConfig, ForgeJvmArgs } from "../../domain/entities";

@injectable()
export class SpawnServerProcessUseCase {
  constructor(private serverProcessRepository: IServerProcessRepository) {}

  async execute(
    serverId: string,
    config: ServerRuntimeConfig,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
    onClose?: (code: number | null) => void
  ): Promise<ServerProcess> {
    return await this.serverProcessRepository.spawnProcess(
      serverId,
      config,
      onStdout,
      onStderr,
      onClose
    );
  }
}

@injectable()
export class SendCommandUseCase {
  constructor(private serverProcessRepository: IServerProcessRepository) {}

  async execute(serverId: string, command: string): Promise<boolean> {
    return await this.serverProcessRepository.sendCommand(serverId, command);
  }
}

@injectable()
export class KillServerProcessUseCase {
  constructor(private serverProcessRepository: IServerProcessRepository) {}

  async execute(serverId: string): Promise<boolean> {
    return await this.serverProcessRepository.killProcess(serverId);
  }
}

@injectable()
export class ReadForgeJvmArgsUseCase {
  constructor(private serverProcessRepository: IServerProcessRepository) {}

  async execute(serverId: string): Promise<ForgeJvmArgs | null> {
    return await this.serverProcessRepository.readForgeJvmArgs(serverId);
  }
}

@injectable()
export class EditForgeJvmArgsUseCase {
  constructor(private serverProcessRepository: IServerProcessRepository) {}

  async execute(serverId: string, minRam: number, maxRam: number): Promise<boolean> {
    return await this.serverProcessRepository.editForgeJvmArgs(serverId, minRam, maxRam);
  }
}

@injectable()
export class OpenServerFolderUseCase {
  constructor(private serverProcessRepository: IServerProcessRepository) {}

  async execute(serverId: string): Promise<boolean> {
    return await this.serverProcessRepository.openServerFolder(serverId);
  }
}
