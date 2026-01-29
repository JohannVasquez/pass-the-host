import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CheckRcloneInstallationUseCase,
  InstallRcloneUseCase,
  TestR2ConnectionUseCase,
  ListR2ServersUseCase,
  DownloadServerFromR2UseCase,
  UploadServerToR2UseCase,
  DeleteServerFromR2UseCase,
  ShouldDownloadServerUseCase,
  CreateServerLockUseCase,
  ReadServerLockUseCase,
  UploadServerLockUseCase,
  DeleteServerLockUseCase,
  DeleteLocalServerLockUseCase,
  CreateSessionUseCase,
  UpdateSessionUseCase,
  UploadSessionUseCase,
  GetServerStatisticsUseCase,
  ReadServerPortUseCase,
  WriteServerPortUseCase,
} from "../../../../../../src/main/contexts/cloud-storage/application/use-cases";
import type {
  IRcloneRepository,
  IS3ServerRepository,
  IServerLockRepository,
  ISessionRepository,
  IServerPropertiesRepository,
} from "../../../../../../src/main/contexts/cloud-storage/domain/repositories";
import type {
  S3Config,
  ServerInfo,
} from "../../../../../../src/main/contexts/cloud-storage/domain/entities/S3Config";
import type { ServerLock } from "../../../../../../src/main/contexts/cloud-storage/domain/entities/ServerLock";
import type { ServerStatistics } from "../../../../../../src/main/contexts/cloud-storage/domain/entities/SessionMetadata";

// Mock repository factories
function createMockRcloneRepository(): IRcloneRepository {
  return {
    checkInstallation: vi.fn(),
    install: vi.fn(),
    testConnection: vi.fn(),
  };
}

function createMockS3ServerRepository(): IS3ServerRepository {
  return {
    listServers: vi.fn(),
    downloadServer: vi.fn(),
    uploadServer: vi.fn(),
    deleteServer: vi.fn(),
    shouldDownloadServer: vi.fn(),
  };
}

function createMockServerLockRepository(): IServerLockRepository {
  return {
    createLock: vi.fn(),
    readLock: vi.fn(),
    uploadLock: vi.fn(),
    deleteLock: vi.fn(),
    deleteLocalLock: vi.fn(),
  };
}

function createMockSessionRepository(): ISessionRepository {
  return {
    createSession: vi.fn(),
    updateSession: vi.fn(),
    uploadSession: vi.fn(),
    getStatistics: vi.fn(),
    readLocalSession: vi.fn(),
  };
}

function createMockServerPropertiesRepository(): IServerPropertiesRepository {
  return {
    readPort: vi.fn(),
    writePort: vi.fn(),
  };
}

// Helper to create test S3Config
function createTestS3Config(): S3Config {
  return {
    provider: "Cloudflare",
    endpoint: "https://test.r2.cloudflarestorage.com",
    region: "auto",
    access_key: "test_access_key",
    secret_key: "test_secret_key",
    bucket_name: "test-bucket",
  };
}

// ========== RCLONE USE CASES ==========

describe("CheckRcloneInstallationUseCase", () => {
  let repository: IRcloneRepository;
  let useCase: CheckRcloneInstallationUseCase;

  beforeEach(() => {
    repository = createMockRcloneRepository();
    useCase = new CheckRcloneInstallationUseCase(repository);
  });

  it("should return true when rclone is installed", async () => {
    (repository.checkInstallation as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute();

    expect(result).toBe(true);
    expect(repository.checkInstallation).toHaveBeenCalled();
  });

  it("should return false when rclone is not installed", async () => {
    (repository.checkInstallation as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute();

    expect(result).toBe(false);
  });
});

describe("InstallRcloneUseCase", () => {
  let repository: IRcloneRepository;
  let useCase: InstallRcloneUseCase;

  beforeEach(() => {
    repository = createMockRcloneRepository();
    useCase = new InstallRcloneUseCase(repository);
  });

  it("should install rclone successfully", async () => {
    (repository.install as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute();

    expect(result).toBe(true);
    expect(repository.install).toHaveBeenCalledWith(undefined);
  });

  it("should pass progress callback to repository", async () => {
    const onProgress = vi.fn();
    (repository.install as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await useCase.execute(onProgress);

    expect(repository.install).toHaveBeenCalledWith(onProgress);
  });

  it("should return false when installation fails", async () => {
    (repository.install as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute();

    expect(result).toBe(false);
  });
});

describe("TestR2ConnectionUseCase", () => {
  let repository: IRcloneRepository;
  let useCase: TestR2ConnectionUseCase;

  beforeEach(() => {
    repository = createMockRcloneRepository();
    useCase = new TestR2ConnectionUseCase(repository);
  });

  it("should return true when connection is successful", async () => {
    const config = createTestS3Config();
    (repository.testConnection as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute(config);

    expect(result).toBe(true);
    expect(repository.testConnection).toHaveBeenCalledWith(config);
  });

  it("should return false when connection fails", async () => {
    const config = createTestS3Config();
    (repository.testConnection as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute(config);

    expect(result).toBe(false);
  });
});

// ========== R2 SERVER USE CASES ==========

describe("ListR2ServersUseCase", () => {
  let repository: IS3ServerRepository;
  let useCase: ListR2ServersUseCase;

  beforeEach(() => {
    repository = createMockS3ServerRepository();
    useCase = new ListR2ServersUseCase(repository);
  });

  it("should list all servers from R2", async () => {
    const config = createTestS3Config();
    const servers: ServerInfo[] = [
      { id: "server-1", name: "Server 1", version: "1.20.4", type: "vanilla" },
      { id: "server-2", name: "Server 2", version: "1.20.1", type: "forge" },
    ];

    (repository.listServers as ReturnType<typeof vi.fn>).mockResolvedValue(servers);

    const result = await useCase.execute(config);

    expect(result).toEqual(servers);
    expect(result).toHaveLength(2);
    expect(repository.listServers).toHaveBeenCalledWith(config);
  });

  it("should return empty array when no servers exist", async () => {
    const config = createTestS3Config();
    (repository.listServers as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await useCase.execute(config);

    expect(result).toEqual([]);
  });
});

describe("DownloadServerFromR2UseCase", () => {
  let repository: IS3ServerRepository;
  let useCase: DownloadServerFromR2UseCase;

  beforeEach(() => {
    repository = createMockS3ServerRepository();
    useCase = new DownloadServerFromR2UseCase(repository);
  });

  it("should download server successfully", async () => {
    const config = createTestS3Config();
    (repository.downloadServer as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute(config, "server-1");

    expect(result).toBe(true);
    expect(repository.downloadServer).toHaveBeenCalledWith(config, "server-1", undefined);
  });

  it("should pass progress callback to repository", async () => {
    const config = createTestS3Config();
    const onProgress = vi.fn();
    (repository.downloadServer as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await useCase.execute(config, "server-1", onProgress);

    expect(repository.downloadServer).toHaveBeenCalledWith(config, "server-1", onProgress);
  });

  it("should return false when download fails", async () => {
    const config = createTestS3Config();
    (repository.downloadServer as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute(config, "server-1");

    expect(result).toBe(false);
  });
});

describe("UploadServerToR2UseCase", () => {
  let repository: IS3ServerRepository;
  let useCase: UploadServerToR2UseCase;

  beforeEach(() => {
    repository = createMockS3ServerRepository();
    useCase = new UploadServerToR2UseCase(repository);
  });

  it("should upload server successfully", async () => {
    const config = createTestS3Config();
    (repository.uploadServer as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute(config, "server-1");

    expect(result).toBe(true);
    expect(repository.uploadServer).toHaveBeenCalledWith(config, "server-1", undefined);
  });

  it("should pass progress callback to repository", async () => {
    const config = createTestS3Config();
    const onProgress = vi.fn();
    (repository.uploadServer as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await useCase.execute(config, "server-1", onProgress);

    expect(repository.uploadServer).toHaveBeenCalledWith(config, "server-1", onProgress);
  });
});

describe("DeleteServerFromR2UseCase", () => {
  let repository: IS3ServerRepository;
  let useCase: DeleteServerFromR2UseCase;

  beforeEach(() => {
    repository = createMockS3ServerRepository();
    useCase = new DeleteServerFromR2UseCase(repository);
  });

  it("should delete server successfully", async () => {
    const config = createTestS3Config();
    (repository.deleteServer as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const result = await useCase.execute(config, "server-1");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(repository.deleteServer).toHaveBeenCalledWith(config, "server-1");
  });

  it("should return error when deletion fails", async () => {
    const config = createTestS3Config();
    (repository.deleteServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "Server not found",
    });

    const result = await useCase.execute(config, "server-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Server not found");
  });
});

describe("ShouldDownloadServerUseCase", () => {
  let repository: IS3ServerRepository;
  let useCase: ShouldDownloadServerUseCase;

  beforeEach(() => {
    repository = createMockS3ServerRepository();
    useCase = new ShouldDownloadServerUseCase(repository);
  });

  it("should return true when server needs download", async () => {
    const config = createTestS3Config();
    (repository.shouldDownloadServer as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute(config, "server-1");

    expect(result).toBe(true);
    expect(repository.shouldDownloadServer).toHaveBeenCalledWith(config, "server-1");
  });

  it("should return false when server is up to date", async () => {
    const config = createTestS3Config();
    (repository.shouldDownloadServer as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await useCase.execute(config, "server-1");

    expect(result).toBe(false);
  });
});

// ========== SERVER LOCK USE CASES ==========

describe("CreateServerLockUseCase", () => {
  let repository: IServerLockRepository;
  let useCase: CreateServerLockUseCase;

  beforeEach(() => {
    repository = createMockServerLockRepository();
    useCase = new CreateServerLockUseCase(repository);
  });

  it("should create lock successfully", () => {
    (repository.createLock as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const result = useCase.execute("server-1", "player123");

    expect(result).toBe(true);
    expect(repository.createLock).toHaveBeenCalledWith("server-1", "player123");
  });

  it("should return false when lock creation fails", () => {
    (repository.createLock as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = useCase.execute("server-1", "player123");

    expect(result).toBe(false);
  });
});

describe("ReadServerLockUseCase", () => {
  let repository: IServerLockRepository;
  let useCase: ReadServerLockUseCase;

  beforeEach(() => {
    repository = createMockServerLockRepository();
    useCase = new ReadServerLockUseCase(repository);
  });

  it("should read existing lock", async () => {
    const config = createTestS3Config();
    const lock: ServerLock = {
      exists: true,
      username: "player123",
      startedAt: "2024-01-15T10:00:00.000Z",
      timestamp: 1705312800000,
    };

    (repository.readLock as ReturnType<typeof vi.fn>).mockResolvedValue(lock);

    const result = await useCase.execute(config, "server-1");

    expect(result).toEqual(lock);
    expect(result.exists).toBe(true);
    expect(repository.readLock).toHaveBeenCalledWith(config, "server-1");
  });

  it("should return non-existent lock", async () => {
    const config = createTestS3Config();
    const lock: ServerLock = { exists: false };

    (repository.readLock as ReturnType<typeof vi.fn>).mockResolvedValue(lock);

    const result = await useCase.execute(config, "server-1");

    expect(result.exists).toBe(false);
  });
});

describe("UploadServerLockUseCase", () => {
  let repository: IServerLockRepository;
  let useCase: UploadServerLockUseCase;

  beforeEach(() => {
    repository = createMockServerLockRepository();
    useCase = new UploadServerLockUseCase(repository);
  });

  it("should upload lock successfully", async () => {
    const config = createTestS3Config();
    (repository.uploadLock as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute(config, "server-1");

    expect(result).toBe(true);
    expect(repository.uploadLock).toHaveBeenCalledWith(config, "server-1");
  });
});

describe("DeleteServerLockUseCase", () => {
  let repository: IServerLockRepository;
  let useCase: DeleteServerLockUseCase;

  beforeEach(() => {
    repository = createMockServerLockRepository();
    useCase = new DeleteServerLockUseCase(repository);
  });

  it("should delete existing lock", async () => {
    const config = createTestS3Config();
    (repository.deleteLock as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      existed: true,
    });

    const result = await useCase.execute(config, "server-1");

    expect(result.success).toBe(true);
    expect(result.existed).toBe(true);
  });

  it("should handle non-existent lock deletion", async () => {
    const config = createTestS3Config();
    (repository.deleteLock as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      existed: false,
    });

    const result = await useCase.execute(config, "server-1");

    expect(result.success).toBe(true);
    expect(result.existed).toBe(false);
  });
});

describe("DeleteLocalServerLockUseCase", () => {
  let repository: IServerLockRepository;
  let useCase: DeleteLocalServerLockUseCase;

  beforeEach(() => {
    repository = createMockServerLockRepository();
    useCase = new DeleteLocalServerLockUseCase(repository);
  });

  it("should delete local lock successfully", () => {
    (repository.deleteLocalLock as ReturnType<typeof vi.fn>).mockReturnValue({
      success: true,
      existed: true,
    });

    const result = useCase.execute("server-1");

    expect(result.success).toBe(true);
    expect(result.existed).toBe(true);
    expect(repository.deleteLocalLock).toHaveBeenCalledWith("server-1");
  });
});

// ========== SESSION USE CASES ==========

describe("CreateSessionUseCase", () => {
  let repository: ISessionRepository;
  let useCase: CreateSessionUseCase;

  beforeEach(() => {
    repository = createMockSessionRepository();
    useCase = new CreateSessionUseCase(repository);
  });

  it("should create session successfully", () => {
    (repository.createSession as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const result = useCase.execute("server-1", "player123");

    expect(result).toBe(true);
    expect(repository.createSession).toHaveBeenCalledWith("server-1", "player123");
  });
});

describe("UpdateSessionUseCase", () => {
  let repository: ISessionRepository;
  let useCase: UpdateSessionUseCase;

  beforeEach(() => {
    repository = createMockSessionRepository();
    useCase = new UpdateSessionUseCase(repository);
  });

  it("should update session successfully", () => {
    (repository.updateSession as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const result = useCase.execute("server-1", "player123");

    expect(result).toBe(true);
    expect(repository.updateSession).toHaveBeenCalledWith("server-1", "player123");
  });
});

describe("UploadSessionUseCase", () => {
  let repository: ISessionRepository;
  let useCase: UploadSessionUseCase;

  beforeEach(() => {
    repository = createMockSessionRepository();
    useCase = new UploadSessionUseCase(repository);
  });

  it("should upload session successfully", async () => {
    const config = createTestS3Config();
    (repository.uploadSession as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await useCase.execute(config, "server-1");

    expect(result).toBe(true);
    expect(repository.uploadSession).toHaveBeenCalledWith(config, "server-1");
  });
});

describe("GetServerStatisticsUseCase", () => {
  let repository: ISessionRepository;
  let useCase: GetServerStatisticsUseCase;

  beforeEach(() => {
    repository = createMockSessionRepository();
    useCase = new GetServerStatisticsUseCase(repository);
  });

  it("should return server statistics", () => {
    const stats: ServerStatistics = {
      totalPlaytime: 7200000,
      sessionCount: 2,
      sessions: [],
    };

    (repository.getStatistics as ReturnType<typeof vi.fn>).mockReturnValue(stats);

    const result = useCase.execute("server-1");

    expect(result).toEqual(stats);
    expect(repository.getStatistics).toHaveBeenCalledWith("server-1");
  });

  it("should return null when no statistics exist", () => {
    (repository.getStatistics as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const result = useCase.execute("server-1");

    expect(result).toBeNull();
  });
});

// ========== SERVER PROPERTIES USE CASES ==========

describe("ReadServerPortUseCase", () => {
  let repository: IServerPropertiesRepository;
  let useCase: ReadServerPortUseCase;

  beforeEach(() => {
    repository = createMockServerPropertiesRepository();
    useCase = new ReadServerPortUseCase(repository);
  });

  it("should read server port", () => {
    (repository.readPort as ReturnType<typeof vi.fn>).mockReturnValue(25565);

    const result = useCase.execute("server-1");

    expect(result).toBe(25565);
    expect(repository.readPort).toHaveBeenCalledWith("server-1");
  });

  it("should read custom port", () => {
    (repository.readPort as ReturnType<typeof vi.fn>).mockReturnValue(25570);

    const result = useCase.execute("server-1");

    expect(result).toBe(25570);
  });
});

describe("WriteServerPortUseCase", () => {
  let repository: IServerPropertiesRepository;
  let useCase: WriteServerPortUseCase;

  beforeEach(() => {
    repository = createMockServerPropertiesRepository();
    useCase = new WriteServerPortUseCase(repository);
  });

  it("should write server port successfully", () => {
    (repository.writePort as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const result = useCase.execute("server-1", 25570);

    expect(result).toBe(true);
    expect(repository.writePort).toHaveBeenCalledWith("server-1", 25570);
  });

  it("should return false when write fails", () => {
    (repository.writePort as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = useCase.execute("server-1", 25570);

    expect(result).toBe(false);
  });
});
