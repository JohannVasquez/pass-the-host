import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CreateMinecraftServerUseCase,
  DeleteServerLocallyUseCase,
  GetLocalServerPathUseCase,
} from "../../../../../../src/main/contexts/server-lifecycle/application/use-cases";
import type { IServerLifecycleRepository } from "../../../../../../src/main/contexts/server-lifecycle/domain/repositories";
import type {
  MinecraftServerConfig,
  ServerCreationResult,
  ServerDeletionResult,
} from "../../../../../../src/main/contexts/server-lifecycle/domain/entities";

function createMockRepository(): IServerLifecycleRepository {
  return {
    createServer: vi.fn(),
    deleteServerLocally: vi.fn(),
    getLocalServerPath: vi.fn(),
  };
}

describe("CreateMinecraftServerUseCase", () => {
  let repository: IServerLifecycleRepository;
  let useCase: CreateMinecraftServerUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new CreateMinecraftServerUseCase(repository);
  });

  it("should create a vanilla server successfully", async () => {
    const config: MinecraftServerConfig = {
      serverName: "My Server",
      version: "1.20.4",
      serverType: "vanilla",
    };
    const expectedResult: ServerCreationResult = { success: true };

    (repository.createServer as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const result = await useCase.execute(config);

    expect(result).toEqual(expectedResult);
    expect(repository.createServer).toHaveBeenCalledWith(config, undefined);
  });

  it("should create a forge server successfully", async () => {
    const config: MinecraftServerConfig = {
      serverName: "Modded Server",
      version: "1.20.1",
      serverType: "forge",
    };
    const expectedResult: ServerCreationResult = { success: true };

    (repository.createServer as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const result = await useCase.execute(config);

    expect(result).toEqual(expectedResult);
    expect(repository.createServer).toHaveBeenCalledWith(config, undefined);
  });

  it("should pass progress callback to repository", async () => {
    const config: MinecraftServerConfig = {
      serverName: "Test Server",
      version: "1.20.4",
      serverType: "vanilla",
    };
    const onProgress = vi.fn();
    const expectedResult: ServerCreationResult = { success: true };

    (repository.createServer as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    await useCase.execute(config, onProgress);

    expect(repository.createServer).toHaveBeenCalledWith(config, onProgress);
  });

  it("should return error result when creation fails", async () => {
    const config: MinecraftServerConfig = {
      serverName: "Failed Server",
      version: "1.20.4",
      serverType: "vanilla",
    };
    const expectedResult: ServerCreationResult = {
      success: false,
      error: "Failed to download server JAR",
    };

    (repository.createServer as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const result = await useCase.execute(config);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to download server JAR");
  });

  it("should handle network errors", async () => {
    const config: MinecraftServerConfig = {
      serverName: "Test Server",
      version: "1.20.4",
      serverType: "vanilla",
    };
    const expectedResult: ServerCreationResult = {
      success: false,
      error: "Network error: Unable to reach server",
    };

    (repository.createServer as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const result = await useCase.execute(config);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
  });
});

describe("DeleteServerLocallyUseCase", () => {
  let repository: IServerLifecycleRepository;
  let useCase: DeleteServerLocallyUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new DeleteServerLocallyUseCase(repository);
  });

  it("should delete server successfully", () => {
    const expectedResult: ServerDeletionResult = { success: true };

    (repository.deleteServerLocally as ReturnType<typeof vi.fn>).mockReturnValue(expectedResult);

    const result = useCase.execute("server-123");

    expect(result.success).toBe(true);
    expect(repository.deleteServerLocally).toHaveBeenCalledWith("server-123");
  });

  it("should return error when server not found", () => {
    const expectedResult: ServerDeletionResult = {
      success: false,
      error: "Server not found",
    };

    (repository.deleteServerLocally as ReturnType<typeof vi.fn>).mockReturnValue(expectedResult);

    const result = useCase.execute("non-existent-server");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Server not found");
  });

  it("should return error on permission denied", () => {
    const expectedResult: ServerDeletionResult = {
      success: false,
      error: "Permission denied",
    };

    (repository.deleteServerLocally as ReturnType<typeof vi.fn>).mockReturnValue(expectedResult);

    const result = useCase.execute("protected-server");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Permission denied");
  });
});

describe("GetLocalServerPathUseCase", () => {
  let repository: IServerLifecycleRepository;
  let useCase: GetLocalServerPathUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new GetLocalServerPathUseCase(repository);
  });

  it("should return server path", () => {
    const expectedPath = "C:\\Users\\user\\AppData\\Roaming\\pass-the-host\\servers\\server-123";

    (repository.getLocalServerPath as ReturnType<typeof vi.fn>).mockReturnValue(expectedPath);

    const result = useCase.execute("server-123");

    expect(result).toBe(expectedPath);
    expect(repository.getLocalServerPath).toHaveBeenCalledWith("server-123");
  });

  it("should return different paths for different servers", () => {
    (repository.getLocalServerPath as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce("/path/to/server-1")
      .mockReturnValueOnce("/path/to/server-2");

    const path1 = useCase.execute("server-1");
    const path2 = useCase.execute("server-2");

    expect(path1).toBe("/path/to/server-1");
    expect(path2).toBe("/path/to/server-2");
  });

  it("should handle Unix-style paths", () => {
    const expectedPath = "/home/user/.local/share/pass-the-host/servers/my-server";

    (repository.getLocalServerPath as ReturnType<typeof vi.fn>).mockReturnValue(expectedPath);

    const result = useCase.execute("my-server");

    expect(result).toBe(expectedPath);
  });
});
