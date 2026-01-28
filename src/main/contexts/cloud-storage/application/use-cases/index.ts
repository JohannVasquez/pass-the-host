import { injectable } from "inversify";
import {
  IRcloneRepository,
  IR2ServerRepository,
  IServerLockRepository,
  ISessionRepository,
  IServerPropertiesRepository,
} from "../../domain/repositories";
import { R2Config, ServerInfo, TransferProgress } from "../../domain/entities/R2Config";
import { ServerLock } from "../../domain/entities/ServerLock";
import { ServerStatistics } from "../../domain/entities/SessionMetadata";

// ========== RCLONE USE CASES ==========

@injectable()
export class CheckRcloneInstallationUseCase {
  constructor(private rcloneRepository: IRcloneRepository) {}

  async execute(): Promise<boolean> {
    return await this.rcloneRepository.checkInstallation();
  }
}

@injectable()
export class InstallRcloneUseCase {
  constructor(private rcloneRepository: IRcloneRepository) {}

  async execute(onProgress?: (message: string) => void): Promise<boolean> {
    return await this.rcloneRepository.install(onProgress);
  }
}

@injectable()
export class TestR2ConnectionUseCase {
  constructor(private rcloneRepository: IRcloneRepository) {}

  async execute(config: R2Config): Promise<boolean> {
    return await this.rcloneRepository.testConnection(config);
  }
}

// ========== R2 SERVER USE CASES ==========

@injectable()
export class ListR2ServersUseCase {
  constructor(private r2ServerRepository: IR2ServerRepository) {}

  async execute(config: R2Config): Promise<ServerInfo[]> {
    return await this.r2ServerRepository.listServers(config);
  }
}

@injectable()
export class DownloadServerFromR2UseCase {
  constructor(private r2ServerRepository: IR2ServerRepository) {}

  async execute(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    return await this.r2ServerRepository.downloadServer(config, serverId, onProgress);
  }
}

@injectable()
export class UploadServerToR2UseCase {
  constructor(private r2ServerRepository: IR2ServerRepository) {}

  async execute(
    config: R2Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    return await this.r2ServerRepository.uploadServer(config, serverId, onProgress);
  }
}

@injectable()
export class DeleteServerFromR2UseCase {
  constructor(private r2ServerRepository: IR2ServerRepository) {}

  async execute(config: R2Config, serverId: string): Promise<{ success: boolean; error?: string }> {
    return await this.r2ServerRepository.deleteServer(config, serverId);
  }
}

@injectable()
export class ShouldDownloadServerUseCase {
  constructor(private r2ServerRepository: IR2ServerRepository) {}

  async execute(config: R2Config, serverId: string): Promise<boolean> {
    return await this.r2ServerRepository.shouldDownloadServer(config, serverId);
  }
}

// ========== SERVER LOCK USE CASES ==========

@injectable()
export class CreateServerLockUseCase {
  constructor(private serverLockRepository: IServerLockRepository) {}

  execute(serverId: string, username: string): boolean {
    return this.serverLockRepository.createLock(serverId, username);
  }
}

@injectable()
export class ReadServerLockUseCase {
  constructor(private serverLockRepository: IServerLockRepository) {}

  async execute(config: R2Config, serverId: string): Promise<ServerLock> {
    return await this.serverLockRepository.readLock(config, serverId);
  }
}

@injectable()
export class UploadServerLockUseCase {
  constructor(private serverLockRepository: IServerLockRepository) {}

  async execute(config: R2Config, serverId: string): Promise<boolean> {
    return await this.serverLockRepository.uploadLock(config, serverId);
  }
}

@injectable()
export class DeleteServerLockUseCase {
  constructor(private serverLockRepository: IServerLockRepository) {}

  async execute(
    config: R2Config,
    serverId: string,
  ): Promise<{ success: boolean; existed: boolean }> {
    return await this.serverLockRepository.deleteLock(config, serverId);
  }
}

@injectable()
export class DeleteLocalServerLockUseCase {
  constructor(private serverLockRepository: IServerLockRepository) {}

  execute(serverId: string): { success: boolean; existed: boolean } {
    return this.serverLockRepository.deleteLocalLock(serverId);
  }
}

// ========== SESSION USE CASES ==========

@injectable()
export class CreateSessionUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  execute(serverId: string, username: string): boolean {
    return this.sessionRepository.createSession(serverId, username);
  }
}

@injectable()
export class UpdateSessionUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  execute(serverId: string, username: string): boolean {
    return this.sessionRepository.updateSession(serverId, username);
  }
}

@injectable()
export class UploadSessionUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  async execute(config: R2Config, serverId: string): Promise<boolean> {
    return await this.sessionRepository.uploadSession(config, serverId);
  }
}

@injectable()
export class GetServerStatisticsUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  execute(serverId: string): ServerStatistics | null {
    return this.sessionRepository.getStatistics(serverId);
  }
}

// ========== SERVER PROPERTIES USE CASES ==========

@injectable()
export class ReadServerPortUseCase {
  constructor(private serverPropertiesRepository: IServerPropertiesRepository) {}

  execute(serverId: string): number {
    return this.serverPropertiesRepository.readPort(serverId);
  }
}

@injectable()
export class WriteServerPortUseCase {
  constructor(private serverPropertiesRepository: IServerPropertiesRepository) {}

  execute(serverId: string, port: number): boolean {
    return this.serverPropertiesRepository.writePort(serverId, port);
  }
}
