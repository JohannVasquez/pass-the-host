import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChildProcessWithoutNullStreams } from "child_process";
import {
  SpawnServerProcessUseCase,
  SendCommandUseCase,
  KillServerProcessUseCase,
  ReadForgeJvmArgsUseCase,
  EditForgeJvmArgsUseCase,
  OpenServerFolderUseCase,
} from "../../../../../../src/main/contexts/server-runtime/application/use-cases";
import type { IServerProcessRepository } from "../../../../../../src/main/contexts/server-runtime/domain/repositories";
import type {
  ServerProcess,
  ServerRuntimeConfig,
  ForgeJvmArgs,
} from "../../../../../../src/main/contexts/server-runtime/domain/entities";

// Mock repository factory
function createMockRepository(): IServerProcessRepository {
  return {
    spawnProcess: vi.fn(),
    getProcess: vi.fn(),
    sendCommand: vi.fn(),
    killProcess: vi.fn(),
    readForgeJvmArgs: vi.fn(),
    editForgeJvmArgs: vi.fn(),
    openServerFolder: vi.fn(),
  };
}

// Mock ServerProcess
function createMockServerProcess(serverId: string): ServerProcess {
  return {
    serverId,
    process: {} as unknown as ChildProcessWithoutNullStreams,
    isRunning: true,
    sendCommand: vi.fn().mockReturnValue(true),
    stop: vi.fn().mockResolvedValue(true),
  } as unknown as ServerProcess;
}

describe("SpawnServerProcessUseCase", () => {
  let repository: IServerProcessRepository;
  let useCase: SpawnServerProcessUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new SpawnServerProcessUseCase(repository);
  });

  it("should spawn a server process with config", async () => {
    const mockServerProcess = createMockServerProcess("server-1");
    const config: ServerRuntimeConfig = {
      workingDir: "/path/to/server",
      command: "java",
      args: ["-jar", "server.jar", "nogui"],
    };

    (repository.spawnProcess as ReturnType<typeof vi.fn>).mockResolvedValue(mockServerProcess);

    const result = await useCase.execute("server-1", config);

    expect(result).toBe(mockServerProcess);
    expect(repository.spawnProcess).toHaveBeenCalledWith(
      "server-1",
      config,
      undefined,
      undefined,
      undefined,
    );
  });

  it("should pass stdout callback to repository", async () => {
    const mockServerProcess = createMockServerProcess("server-1");
    const config: ServerRuntimeConfig = {
      workingDir: "/path/to/server",
      command: "java",
      args: [],
    };
    const onStdout = vi.fn();

    (repository.spawnProcess as ReturnType<typeof vi.fn>).mockResolvedValue(mockServerProcess);

    await useCase.execute("server-1", config, onStdout);

    expect(repository.spawnProcess).toHaveBeenCalledWith(
      "server-1",
      config,
      onStdout,
      undefined,
      undefined,
    );
  });

  it("should pass all callbacks to repository", async () => {
    const mockServerProcess = createMockServerProcess("server-1");
    const config: ServerRuntimeConfig = {
      workingDir: "/path/to/server",
      command: "java",
      args: [],
    };
    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const onClose = vi.fn();

    (repository.spawnProcess as ReturnType<typeof vi.fn>).mockResolvedValue(mockServerProcess);

    await useCase.execute("server-1", config, onStdout, onStderr, onClose);

    expect(repository.spawnProcess).toHaveBeenCalledWith(
      "server-1",
      config,
      onStdout,
      onStderr,
      onClose,
    );
  });
});

describe("SendCommandUseCase", () => {
  let repository: IServerProcessRepository;
  let useCase: SendCommandUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new SendCommandUseCase(repository);
  });

  it("should send command to running server", async () => {
    (repository.sendCommand as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute("server-1", "say Hello");

    expect(result).toBe(true);
    expect(repository.sendCommand).toHaveBeenCalledWith("server-1", "say Hello");
  });

  it("should return false when server is not running", async () => {
    (repository.sendCommand as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute("server-1", "say Hello");

    expect(result).toBe(false);
  });

  it("should handle different commands", async () => {
    (repository.sendCommand as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await useCase.execute("server-1", "op player1");
    await useCase.execute("server-1", "gamemode creative player1");
    await useCase.execute("server-1", "stop");

    expect(repository.sendCommand).toHaveBeenCalledTimes(3);
    expect(repository.sendCommand).toHaveBeenNthCalledWith(1, "server-1", "op player1");
    expect(repository.sendCommand).toHaveBeenNthCalledWith(
      2,
      "server-1",
      "gamemode creative player1",
    );
    expect(repository.sendCommand).toHaveBeenNthCalledWith(3, "server-1", "stop");
  });
});

describe("KillServerProcessUseCase", () => {
  let repository: IServerProcessRepository;
  let useCase: KillServerProcessUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new KillServerProcessUseCase(repository);
  });

  it("should kill a running server process", async () => {
    (repository.killProcess as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute("server-1");

    expect(result).toBe(true);
    expect(repository.killProcess).toHaveBeenCalledWith("server-1");
  });

  it("should return false when server is not found", async () => {
    (repository.killProcess as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute("non-existent-server");

    expect(result).toBe(false);
  });
});

describe("ReadForgeJvmArgsUseCase", () => {
  let repository: IServerProcessRepository;
  let useCase: ReadForgeJvmArgsUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new ReadForgeJvmArgsUseCase(repository);
  });

  it("should read Forge JVM args from server", async () => {
    const forgeArgs: ForgeJvmArgs = {
      allArgs: ["-Xmx4G", "-Xms2G"],
      minRam: "2G",
      maxRam: "4G",
    };

    (repository.readForgeJvmArgs as ReturnType<typeof vi.fn>).mockResolvedValue(forgeArgs);

    const result = await useCase.execute("server-1");

    expect(result).toEqual(forgeArgs);
    expect(repository.readForgeJvmArgs).toHaveBeenCalledWith("server-1");
  });

  it("should return null when Forge args not found", async () => {
    (repository.readForgeJvmArgs as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await useCase.execute("vanilla-server");

    expect(result).toBeNull();
  });
});

describe("EditForgeJvmArgsUseCase", () => {
  let repository: IServerProcessRepository;
  let useCase: EditForgeJvmArgsUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new EditForgeJvmArgsUseCase(repository);
  });

  it("should edit Forge JVM args", async () => {
    (repository.editForgeJvmArgs as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute("server-1", 2, 4);

    expect(result).toBe(true);
    expect(repository.editForgeJvmArgs).toHaveBeenCalledWith("server-1", 2, 4);
  });

  it("should return false when editing fails", async () => {
    (repository.editForgeJvmArgs as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute("server-1", 2, 4);

    expect(result).toBe(false);
  });

  it("should handle different RAM values", async () => {
    (repository.editForgeJvmArgs as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await useCase.execute("server-1", 1, 8);
    await useCase.execute("server-2", 4, 16);

    expect(repository.editForgeJvmArgs).toHaveBeenCalledWith("server-1", 1, 8);
    expect(repository.editForgeJvmArgs).toHaveBeenCalledWith("server-2", 4, 16);
  });
});

describe("OpenServerFolderUseCase", () => {
  let repository: IServerProcessRepository;
  let useCase: OpenServerFolderUseCase;

  beforeEach(() => {
    repository = createMockRepository();
    useCase = new OpenServerFolderUseCase(repository);
  });

  it("should open server folder successfully", async () => {
    (repository.openServerFolder as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute("server-1");

    expect(result).toBe(true);
    expect(repository.openServerFolder).toHaveBeenCalledWith("server-1");
  });

  it("should return false when folder cannot be opened", async () => {
    (repository.openServerFolder as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute("non-existent-server");

    expect(result).toBe(false);
  });
});
