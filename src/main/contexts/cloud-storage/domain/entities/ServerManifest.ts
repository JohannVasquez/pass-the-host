export interface ServerManifestFileEntry {
  path: string;
  hash: string;
  size: number;
  mtimeMs: number;
}

export interface ServerManifest {
  version: number;
  generatedAt: string;
  algorithm: "sha1";
  files: ServerManifestFileEntry[];
}

export interface ServerManifestDiff {
  newFiles: ServerManifestFileEntry[];
  modifiedFiles: ServerManifestFileEntry[];
  deletedFiles: ServerManifestFileEntry[];
  unchangedFiles: ServerManifestFileEntry[];
}

export interface DifferentialSyncResult {
  uploadedFiles: string[];
  downloadedFiles: string[];
  deletedRemoteFiles: string[];
  deletedLocalFiles: string[];
  manifest: ServerManifest;
}

export interface ManifestCache {
  version: number;
  algorithm: "sha1";
  files: ServerManifestFileEntry[];
}
