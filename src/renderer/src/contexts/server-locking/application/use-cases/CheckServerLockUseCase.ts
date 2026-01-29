import { injectable, inject } from "inversify";
import type { IServerLockRepository } from "@server-locking/domain/repositories";
import type { LockCheckResult } from "@server-locking/domain/entities";
import type { S3Config } from "@cloud-storage/domain/entities";
import { SERVER_LOCKING_TYPES } from "@shared/di";

/**
 * Check Server Lock Use Case
 * Checks if a server is locked in S3-compatible storage
 */
@injectable()
export class CheckServerLockUseCase {
  constructor(
    @inject(SERVER_LOCKING_TYPES.ServerLockRepository)
    private repository: IServerLockRepository,
  ) {}

  async execute(s3Config: S3Config, serverId: string): Promise<LockCheckResult> {
    if (!serverId) {
      throw new Error("ServerId is required");
    }

    return await this.repository.readRemoteLock(s3Config, serverId);
  }
}
