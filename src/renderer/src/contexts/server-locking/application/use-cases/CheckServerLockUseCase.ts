import { injectable, inject } from "inversify";
import type { IServerLockRepository } from "../../domain/repositories";
import type { LockCheckResult } from "../../domain/entities";
import type { R2Config } from "@cloud-storage/domain/entities";
import { SERVER_LOCKING_TYPES } from "@shared/di";

/**
 * Check Server Lock Use Case
 * Checks if a server is locked in R2 storage
 */
@injectable()
export class CheckServerLockUseCase {
  constructor(
    @inject(SERVER_LOCKING_TYPES.ServerLockRepository)
    private repository: IServerLockRepository,
  ) {}

  async execute(r2Config: R2Config, serverId: string): Promise<LockCheckResult> {
    if (!serverId) {
      throw new Error("ServerId is required");
    }

    return await this.repository.readRemoteLock(r2Config, serverId);
  }
}
