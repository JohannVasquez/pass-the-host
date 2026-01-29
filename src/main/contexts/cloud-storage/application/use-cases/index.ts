import { injectable } from "inversify";
import {
  IRcloneRepository,
  IS3ServerRepository,
  IServerLockRepository,
  ISessionRepository,
  IServerPropertiesRepository,
} from "../../domain/repositories";
import { S3Config, ServerInfo, TransferProgress } from "../../domain/entities/S3Config";
import { ServerLock } from "../../domain/entities/ServerLock";
import { ServerStatistics } from "../../domain/entities/SessionMetadata";
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
  async execute(config: S3Config): Promise<boolean> {
    return await this.rcloneRepository.testConnection(config);
  }
}
@injectable()
export class ListR2ServersUseCase {
  constructor(private s3ServerRepository: IS3ServerRepository) {}
  async execute(config: S3Config): Promise<ServerInfo[]> {
    return await this.s3ServerRepository.listServers(config);
  }
}
@injectable()
export class DownloadServerFromR2UseCase {
  constructor(private s3ServerRepository: IS3ServerRepository) {}
  async execute(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    return await this.s3ServerRepository.downloadServer(config, serverId, onProgress);
  }
}
@injectable()
export class UploadServerToR2UseCase {
  constructor(private s3ServerRepository: IS3ServerRepository) {}
  async execute(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<boolean> {
    return await this.s3ServerRepository.uploadServer(config, serverId, onProgress);
  }
}
@injectable()
export class DeleteServerFromR2UseCase {
  constructor(private s3ServerRepository: IS3ServerRepository) {}
  async execute(config: S3Config, serverId: string): Promise<{ success: boolean; error?: string }> {
    return await this.s3ServerRepository.deleteServer(config, serverId);
  }
}
@injectable()
export class ShouldDownloadServerUseCase {
  constructor(private s3ServerRepository: IS3ServerRepository) {}
  async execute(config: S3Config, serverId: string): Promise<boolean> {
    return await this.s3ServerRepository.shouldDownloadServer(config, serverId);
  }
}
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
  async execute(config: S3Config, serverId: string): Promise<ServerLock> {
    return await this.serverLockRepository.readLock(config, serverId);
  }
}
@injectable()
export class UploadServerLockUseCase {
  constructor(private serverLockRepository: IServerLockRepository) {}
  async execute(config: S3Config, serverId: string): Promise<boolean> {
    return await this.serverLockRepository.uploadLock(config, serverId);
  }
}
@injectable()
export class DeleteServerLockUseCase {
  constructor(private serverLockRepository: IServerLockRepository) {}
  async execute(
    config: S3Config,
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
  async execute(config: S3Config, serverId: string): Promise<boolean> {
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
