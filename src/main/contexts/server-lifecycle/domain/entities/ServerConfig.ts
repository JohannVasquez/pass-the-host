export type EngineType = "vanilla" | "paper" | "fabric" | "quilt" | "forge" | "neoforge";

export interface MinecraftServerConfig {
  serverName: string;
  /** Name shown in the app; serverName is the folder / cloud id derived from it. */
  displayName?: string;
  version: string;
  serverType: EngineType;
  /** Loader/build/installer version; the recommended one is resolved when missing. */
  engineVersion?: string;
  overwrite?: boolean;
}

export interface ServerCreationResult {
  success: boolean;
  error?: string;
  errorCode?: "SERVER_EXISTS" | "JAVA_NOT_FOUND" | "NETWORK_ERROR" | "UNKNOWN";
}

export interface ServerDeletionResult {
  success: boolean;
  error?: string;
}

export interface LocalServerInfo {
  id: string;
  name: string;
  version: string;
  type: EngineType | "unknown";
  loaderVersion?: string;
  /** Where this copy was last synced, from the cloud-storage context's .cloud-location.json */
  cloudLocation?: { provider: string; bucket?: string };
}
