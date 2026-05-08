import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IS3SyncRemoteRepository,
  IS3SyncService,
} from "@main/contexts/cloud-storage/domain/repositories";
import type {
  S3Config,
  ServerManifest,
  ServerManifestFileEntry,
} from "@main/contexts/cloud-storage/domain/entities";
import { S3SyncService } from "@main/contexts/cloud-storage/infrastructure/services/S3SyncService";

let userDataPath = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === "userData") {
        return userDataPath;
      }

      return os.tmpdir();
    }),
  },
}));

function createConfig(): S3Config {
  return {
    provider: "Cloudflare",
    endpoint: "https://example.r2.cloudflarestorage.com",
    region: "auto",
    access_key: "access",
    secret_key: "secret",
    bucket_name: "bucket",
  };
}

function createEntry(
  relativePath: string,
  hash: string,
  size = 1,
  mtimeMs = 1,
): ServerManifestFileEntry {
  return { path: relativePath, hash, size, mtimeMs };
}

function createRemoteRepository(): IS3SyncRemoteRepository {
  return {
    readManifest: vi.fn(),
    uploadManifest: vi.fn(),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn(),
    fullDownloadServer: vi.fn(),
  };
}

describe("S3SyncService", () => {
  let remoteRepository: IS3SyncRemoteRepository;
  let service: IS3SyncService;
  let serverRoot: string;

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "pth-sync-"));
    serverRoot = path.join(userDataPath, "servers", "server-1");
    fs.mkdirSync(serverRoot, { recursive: true });
    remoteRepository = createRemoteRepository();
    service = new S3SyncService(remoteRepository);
  });

  it("should build a local manifest and ignore transient files", async () => {
    fs.writeFileSync(path.join(serverRoot, "server.jar"), "jar", "utf-8");
    fs.writeFileSync(path.join(serverRoot, "session.json"), "{}", "utf-8");
    fs.mkdirSync(path.join(serverRoot, "logs"), { recursive: true });
    fs.writeFileSync(path.join(serverRoot, "logs", "latest.log"), "ignore", "utf-8");

    const manifest = await service.buildLocalManifest("server-1");

    expect(manifest.files.map((file) => file.path)).toEqual(["server.jar"]);
    expect(manifest.algorithm).toBe("sha1");
  });

  it("should diff manifests by new, modified, deleted and unchanged files", async () => {
    const localManifest: ServerManifest = {
      version: 1,
      generatedAt: "2026-05-07T00:00:00.000Z",
      algorithm: "sha1",
      files: [
        createEntry("new.txt", "a"),
        createEntry("same.txt", "b"),
        createEntry("changed.txt", "new-hash"),
      ],
    };
    const remoteManifest: ServerManifest = {
      version: 1,
      generatedAt: "2026-05-07T00:00:00.000Z",
      algorithm: "sha1",
      files: [
        createEntry("same.txt", "b"),
        createEntry("changed.txt", "old-hash"),
        createEntry("deleted.txt", "c"),
      ],
    };

    const diff = service.diffManifests(localManifest, remoteManifest);

    expect(diff.newFiles.map((file) => file.path)).toEqual(["new.txt"]);
    expect(diff.modifiedFiles.map((file) => file.path)).toEqual(["changed.txt"]);
    expect(diff.deletedFiles.map((file) => file.path)).toEqual(["deleted.txt"]);
    expect(diff.unchangedFiles.map((file) => file.path)).toEqual(["same.txt"]);
  });

  it("should upload only changed files and delete removed remote files", async () => {
    fs.writeFileSync(path.join(serverRoot, "same.txt"), "same", "utf-8");
    fs.writeFileSync(path.join(serverRoot, "changed.txt"), "new", "utf-8");
    fs.writeFileSync(path.join(serverRoot, "new.txt"), "brand new", "utf-8");

    const localManifest = await service.buildLocalManifest("server-1");
    const changedEntry = localManifest.files.find((file) => file.path === "changed.txt");

    (remoteRepository.readManifest as ReturnType<typeof vi.fn>).mockResolvedValue({
      version: 1,
      generatedAt: "2026-05-07T00:00:00.000Z",
      algorithm: "sha1",
      files: [
        createEntry("same.txt", localManifest.files.find((file) => file.path === "same.txt")!.hash, 4, 1),
        createEntry("changed.txt", "outdated", changedEntry?.size || 3, 1),
        createEntry("removed.txt", "old", 3, 1),
      ],
    } satisfies ServerManifest);

    const result = await service.uploadServer(createConfig(), "server-1");

    expect(remoteRepository.uploadFile).toHaveBeenCalledTimes(2);
    expect(remoteRepository.uploadFile).toHaveBeenCalledWith(
      createConfig(),
      "server-1",
      "changed.txt",
      path.join(serverRoot, "changed.txt"),
    );
    expect(remoteRepository.uploadFile).toHaveBeenCalledWith(
      createConfig(),
      "server-1",
      "new.txt",
      path.join(serverRoot, "new.txt"),
    );
    expect(remoteRepository.deleteFile).toHaveBeenCalledWith(
      createConfig(),
      "server-1",
      "removed.txt",
    );
    expect(remoteRepository.uploadManifest).toHaveBeenCalledTimes(1);
    expect(result.deletedRemoteFiles).toEqual(["removed.txt"]);
  });

  it("should download only changed files and delete missing local files", async () => {
    fs.writeFileSync(path.join(serverRoot, "same.txt"), "same", "utf-8");
    fs.writeFileSync(path.join(serverRoot, "old-local.txt"), "remove me", "utf-8");
    fs.writeFileSync(path.join(serverRoot, "changed.txt"), "old", "utf-8");

    const existingManifest = await service.buildLocalManifest("server-1");
    const sameHash = existingManifest.files.find((file) => file.path === "same.txt")!.hash;

    (remoteRepository.readManifest as ReturnType<typeof vi.fn>).mockResolvedValue({
      version: 1,
      generatedAt: "2026-05-07T00:00:00.000Z",
      algorithm: "sha1",
      files: [
        createEntry("same.txt", sameHash, 4, 1),
        createEntry("changed.txt", "remote-new", 7, 1),
        createEntry("new-remote.txt", "remote", 6, 1),
      ],
    } satisfies ServerManifest);

    const result = await service.downloadServer(createConfig(), "server-1");

    expect(remoteRepository.downloadFile).toHaveBeenCalledTimes(2);
    expect(remoteRepository.downloadFile).toHaveBeenCalledWith(
      createConfig(),
      "server-1",
      "changed.txt",
      path.join(serverRoot, "changed.txt"),
    );
    expect(remoteRepository.downloadFile).toHaveBeenCalledWith(
      createConfig(),
      "server-1",
      "new-remote.txt",
      path.join(serverRoot, "new-remote.txt"),
    );
    expect(fs.existsSync(path.join(serverRoot, "old-local.txt"))).toBe(false);
    expect(result.deletedLocalFiles).toEqual(["old-local.txt"]);
  });

  it("should fall back to full download when remote manifest does not exist", async () => {
    fs.writeFileSync(path.join(serverRoot, "bootstrap.txt"), "after sync", "utf-8");
    (remoteRepository.readManifest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (remoteRepository.fullDownloadServer as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await service.downloadServer(createConfig(), "server-1");

    expect(remoteRepository.fullDownloadServer).toHaveBeenCalledTimes(1);
    expect(result.downloadedFiles).toContain("bootstrap.txt");
  });
});
