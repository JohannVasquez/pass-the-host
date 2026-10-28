import { describe, it, expect, vi } from "vitest";
import { StopManagedServerUseCase } from "@renderer/contexts/server-runtime/application/use-cases/StopManagedServerUseCase";
import { ServerStatus } from "@renderer/domain/entities/ServerStatus";
import type { S3Config } from "@renderer/domain/entities/ServerConfig";

const setup = (): {
  useCase: StopManagedServerUseCase;
  deps: Record<string, ReturnType<typeof vi.fn>>;
  updateStatus: ReturnType<typeof vi.fn>;
} => {
  const deps = {
    killServerProcess: vi.fn().mockResolvedValue(true),
    waitForServerExit: vi.fn().mockResolvedValue(true),
    deleteLock: vi.fn().mockResolvedValue(true),
    deleteLocalLock: vi.fn().mockResolvedValue(true),
    updateSession: vi.fn().mockResolvedValue(true),
    uploadServer: vi.fn().mockResolvedValue(true),
    uploadSession: vi.fn().mockResolvedValue(true),
  };
  const updateStatus = vi.fn();
  const useCase = new StopManagedServerUseCase(deps, {
    log: vi.fn(),
    updateStatus,
    startTransfer: vi.fn(),
    updateTransfer: vi.fn(),
    stopTransfer: vi.fn(),
    setServerStartTime: vi.fn(),
  });
  return { useCase, deps, updateStatus };
};

const request = {
  serverId: "survival",
  username: "Johann",
  s3Config: { provider: "Cloudflare" } as S3Config,
  isCloudSyncEnabled: true,
};

describe("StopManagedServerUseCase", () => {
  it("after a crash, frees both locks and uploads the world without killing anything", async () => {
    const { useCase, deps, updateStatus } = setup();
    await useCase.finalize(request);

    expect(deps.killServerProcess).not.toHaveBeenCalled();
    expect(deps.deleteLock).toHaveBeenCalledWith(request.s3Config, "survival");
    expect(deps.deleteLocalLock).toHaveBeenCalledWith("survival");
    expect(deps.uploadServer).toHaveBeenCalledWith("survival");
    expect(deps.uploadSession).toHaveBeenCalled();
    expect(updateStatus).toHaveBeenLastCalledWith(ServerStatus.STOPPED, expect.any(String), {
      force: true,
    });
  });

  it("a normal stop kills the process and then runs the same cleanup", async () => {
    const { useCase, deps } = setup();
    await useCase.execute(request);

    expect(deps.killServerProcess).toHaveBeenCalledWith("survival");
    expect(deps.deleteLock).toHaveBeenCalled();
    expect(deps.uploadServer).toHaveBeenCalled();
  });
});
