import { injectable } from "inversify";
import { app } from "electron";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import type {
  IS3SyncRemoteRepository,
  IS3SyncService,
} from "@main/contexts/cloud-storage/domain/repositories";
import type {
  DifferentialSyncResult,
  ManifestCache,
  S3Config,
  ServerManifest,
  ServerManifestDiff,
  ServerManifestFileEntry,
  TransferProgress,
} from "@main/contexts/cloud-storage/domain/entities";
import { FileSystemError } from "@shared/domain/errors";

const MANIFEST_VERSION = 1;
const MANIFEST_ALGORITHM = "sha1" as const;
const HASH_CACHE_FILE = ".cloud-sync-manifest-cache.json";
const REMOTE_MANIFEST_FILE = "manifest.json";
@injectable()
export class S3SyncService implements IS3SyncService {
  private readonly ignoredPatterns = [
    /^session\.json$/,
    /^server\.lock$/,
    /^session\.lock$/,
    /^\.cloud-sync-state\.json$/,
    /^\.cloud-sync-manifest-cache\.json$/,
    /^manifest\.json$/,
    /^logs\//,
    /^crash-reports\//,
    /\.log$/,
  ];

  constructor(private readonly remoteRepository: IS3SyncRemoteRepository) {}

  async buildLocalManifest(serverId: string): Promise<ServerManifest> {
    const localServerPath = this.getLocalServerPath(serverId);

    if (!fs.existsSync(localServerPath)) {
      return this.createManifest([]);
    }

    const cachedManifest = this.readManifestCache(serverId);
    const cachedEntries = new Map(
      (cachedManifest?.files || []).map((file) => [file.path, file] satisfies [string, ServerManifestFileEntry]),
    );

    const filePaths = this.listManifestEligibleFiles(localServerPath);
    const manifestEntries: ServerManifestFileEntry[] = [];

    for (const relativePath of filePaths) {
      const absolutePath = path.join(localServerPath, relativePath);
      const stats = fs.statSync(absolutePath);
      const normalizedPath = relativePath.replace(/\\/g, "/");
      const cachedEntry = cachedEntries.get(normalizedPath);

      if (
        cachedEntry &&
        cachedEntry.size === stats.size &&
        cachedEntry.mtimeMs === stats.mtimeMs
      ) {
        manifestEntries.push(cachedEntry);
        continue;
      }

      manifestEntries.push({
        path: normalizedPath,
        hash: await this.computeSha1(absolutePath),
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      });
    }

    manifestEntries.sort((left, right) => left.path.localeCompare(right.path));

    const manifest = this.createManifest(manifestEntries);
    this.writeManifestCache(serverId, manifest);
    return manifest;
  }

  diffManifests(local: ServerManifest, remote: ServerManifest): ServerManifestDiff {
    const remoteByPath = new Map(remote.files.map((file) => [file.path, file]));
    const localByPath = new Map(local.files.map((file) => [file.path, file]));

    const diff: ServerManifestDiff = {
      newFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      unchangedFiles: [],
    };

    for (const localFile of local.files) {
      const remoteFile = remoteByPath.get(localFile.path);

      if (!remoteFile) {
        diff.newFiles.push(localFile);
        continue;
      }

      if (remoteFile.hash !== localFile.hash) {
        diff.modifiedFiles.push(localFile);
        continue;
      }

      diff.unchangedFiles.push(localFile);
    }

    for (const remoteFile of remote.files) {
      if (!localByPath.has(remoteFile.path)) {
        diff.deletedFiles.push(remoteFile);
      }
    }

    return diff;
  }

  async uploadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<DifferentialSyncResult> {
    const localServerPath = this.getLocalServerPath(serverId);

    if (!fs.existsSync(localServerPath)) {
      throw new FileSystemError(`Local server directory not found for ${serverId}`);
    }

    const localManifest = await this.buildLocalManifest(serverId);
    const remoteManifest = (await this.remoteRepository.readManifest(config, serverId)) ||
      this.createManifest([]);
    const diff = this.diffManifests(localManifest, remoteManifest);
    const filesToUpload = [...diff.newFiles, ...diff.modifiedFiles];

    let completedOperations = 0;
    const totalOperations = filesToUpload.length + diff.deletedFiles.length + 1;

    const notifyProgress = (processedLabel: string): void => {
      completedOperations += 1;
      onProgress?.({
        percent: this.calculatePercent(completedOperations, totalOperations),
        transferred: processedLabel,
        total: `${completedOperations}/${totalOperations} operations`,
      });
    };

    for (const file of filesToUpload) {
      await this.remoteRepository.uploadFile(
        config,
        serverId,
        file.path,
        path.join(localServerPath, file.path),
      );
      notifyProgress(`Uploaded ${file.path}`);
    }

    for (const file of diff.deletedFiles) {
      await this.remoteRepository.deleteFile(config, serverId, file.path);
      notifyProgress(`Deleted ${file.path}`);
    }

    await this.remoteRepository.uploadManifest(config, serverId, localManifest);
    notifyProgress(`Uploaded ${REMOTE_MANIFEST_FILE}`);

    return {
      uploadedFiles: filesToUpload.map((file) => file.path),
      downloadedFiles: [],
      deletedRemoteFiles: diff.deletedFiles.map((file) => file.path),
      deletedLocalFiles: [],
      manifest: localManifest,
    };
  }

  async downloadServer(
    config: S3Config,
    serverId: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<DifferentialSyncResult> {
    const localServerPath = this.getLocalServerPath(serverId);
    fs.mkdirSync(localServerPath, { recursive: true });

    const remoteManifest = await this.remoteRepository.readManifest(config, serverId);

    if (!remoteManifest) {
      await this.remoteRepository.fullDownloadServer(config, serverId, localServerPath, onProgress);
      const manifest = await this.buildLocalManifest(serverId);
      return {
        uploadedFiles: [],
        downloadedFiles: manifest.files.map((file) => file.path),
        deletedRemoteFiles: [],
        deletedLocalFiles: [],
        manifest,
      };
    }

    const localManifest = await this.buildLocalManifest(serverId);
    const diff = this.diffManifests(remoteManifest, localManifest);
    const filesToDownload = [...diff.newFiles, ...diff.modifiedFiles];

    let completedOperations = 0;
    const totalOperations = filesToDownload.length + diff.deletedFiles.length;

    const notifyProgress = (processedLabel: string): void => {
      if (totalOperations === 0) {
        onProgress?.({ percent: 100, transferred: processedLabel, total: "0 operations" });
        return;
      }

      completedOperations += 1;
      onProgress?.({
        percent: this.calculatePercent(completedOperations, totalOperations),
        transferred: processedLabel,
        total: `${completedOperations}/${totalOperations} operations`,
      });
    };

    for (const file of filesToDownload) {
      await this.remoteRepository.downloadFile(
        config,
        serverId,
        file.path,
        path.join(localServerPath, file.path),
      );
      notifyProgress(`Downloaded ${file.path}`);
    }

    for (const file of diff.deletedFiles) {
      this.deleteLocalFile(path.join(localServerPath, file.path), localServerPath);
      notifyProgress(`Deleted ${file.path}`);
    }

    this.writeManifestCache(serverId, remoteManifest);
    onProgress?.({ percent: 100, transferred: "Complete", total: "Complete" });

    return {
      uploadedFiles: [],
      downloadedFiles: filesToDownload.map((file) => file.path),
      deletedRemoteFiles: [],
      deletedLocalFiles: diff.deletedFiles.map((file) => file.path),
      manifest: remoteManifest,
    };
  }

  async hasRemoteChanges(config: S3Config, serverId: string): Promise<boolean> {
    const remoteManifest = await this.remoteRepository.readManifest(config, serverId);

    if (!remoteManifest) {
      return false;
    }

    const localManifest = await this.buildLocalManifest(serverId);
    const diff = this.diffManifests(remoteManifest, localManifest);

    return diff.newFiles.length > 0 || diff.modifiedFiles.length > 0 || diff.deletedFiles.length > 0;
  }

  private createManifest(files: ServerManifestFileEntry[]): ServerManifest {
    return {
      version: MANIFEST_VERSION,
      generatedAt: new Date().toISOString(),
      algorithm: MANIFEST_ALGORITHM,
      files,
    };
  }

  private getLocalServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }

  private getManifestCachePath(serverId: string): string {
    return path.join(this.getLocalServerPath(serverId), HASH_CACHE_FILE);
  }

  private listManifestEligibleFiles(serverPath: string, relativeDir = ""): string[] {
    const targetDir = relativeDir ? path.join(serverPath, relativeDir) : serverPath;
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const discoveredFiles: string[] = [];

    for (const entry of entries) {
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      const normalizedPath = relativePath.replace(/\\/g, "/");

      if (this.shouldIgnore(normalizedPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        discoveredFiles.push(...this.listManifestEligibleFiles(serverPath, relativePath));
        continue;
      }

      if (entry.isFile()) {
        discoveredFiles.push(normalizedPath);
      }
    }

    return discoveredFiles;
  }

  private shouldIgnore(relativePath: string): boolean {
    return this.ignoredPatterns.some((pattern) => pattern.test(relativePath));
  }

  private async computeSha1(filePath: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash(MANIFEST_ALGORITHM);
      const stream = fs.createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  private readManifestCache(serverId: string): ManifestCache | null {
    const cachePath = this.getManifestCachePath(serverId);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(cachePath, "utf-8")) as ManifestCache;
    } catch {
      return null;
    }
  }

  private writeManifestCache(serverId: string, manifest: ServerManifest): void {
    const cachePath = this.getManifestCachePath(serverId);
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const cache: ManifestCache = {
      version: manifest.version,
      algorithm: manifest.algorithm,
      files: manifest.files,
    };

    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
  }

  private calculatePercent(completed: number, total: number): number {
    if (total <= 0) {
      return 100;
    }

    return Math.min(100, Math.round((completed / total) * 100));
  }

  private deleteLocalFile(filePath: string, serverRootPath: string): void {
    if (!fs.existsSync(filePath)) {
      return;
    }

    fs.unlinkSync(filePath);
    this.deleteEmptyParentDirectories(path.dirname(filePath), serverRootPath);
  }

  private deleteEmptyParentDirectories(currentPath: string, stopPath: string): void {
    let cursor = currentPath;

    while (cursor.startsWith(stopPath) && cursor !== stopPath) {
      if (!fs.existsSync(cursor) || fs.readdirSync(cursor).length > 0) {
        return;
      }

      fs.rmdirSync(cursor);
      cursor = path.dirname(cursor);
    }
  }
}
