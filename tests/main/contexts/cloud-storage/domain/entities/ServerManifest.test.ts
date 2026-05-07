import { describe, expect, it } from "vitest";
import type {
  DifferentialSyncResult,
  ManifestCache,
  ServerManifest,
  ServerManifestDiff,
  ServerManifestFileEntry,
} from "@main/contexts/cloud-storage/domain/entities/ServerManifest";

describe("ServerManifest", () => {
  it("should describe a sha1 manifest", () => {
    const manifest: ServerManifest = {
      version: 1,
      generatedAt: "2026-05-07T00:00:00.000Z",
      algorithm: "sha1",
      files: [
        {
          path: "world/level.dat",
          hash: "abc123",
          size: 123,
          mtimeMs: 456,
        },
      ],
    };

    expect(manifest.algorithm).toBe("sha1");
    expect(manifest.files[0].path).toBe("world/level.dat");
  });
});

describe("ServerManifestDiff", () => {
  it("should classify file changes", () => {
    const entry: ServerManifestFileEntry = {
      path: "mods/example.jar",
      hash: "hash",
      size: 100,
      mtimeMs: 200,
    };
    const diff: ServerManifestDiff = {
      newFiles: [entry],
      modifiedFiles: [],
      deletedFiles: [],
      unchangedFiles: [],
    };

    expect(diff.newFiles).toHaveLength(1);
    expect(diff.newFiles[0].path).toBe("mods/example.jar");
  });
});

describe("DifferentialSyncResult", () => {
  it("should summarize sync actions", () => {
    const result: DifferentialSyncResult = {
      uploadedFiles: ["server.jar"],
      downloadedFiles: [],
      deletedRemoteFiles: ["old.log"],
      deletedLocalFiles: [],
      manifest: {
        version: 1,
        generatedAt: "2026-05-07T00:00:00.000Z",
        algorithm: "sha1",
        files: [],
      },
    };

    expect(result.uploadedFiles).toContain("server.jar");
    expect(result.deletedRemoteFiles).toContain("old.log");
  });
});

describe("ManifestCache", () => {
  it("should store hash metadata for reuse", () => {
    const cache: ManifestCache = {
      version: 1,
      algorithm: "sha1",
      files: [],
    };

    expect(cache.version).toBe(1);
    expect(cache.algorithm).toBe("sha1");
  });
});
