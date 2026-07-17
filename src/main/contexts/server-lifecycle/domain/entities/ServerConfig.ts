export interface MinecraftServerConfig {
  serverName: string;
  version: string;
  serverType: "vanilla" | "forge" | "neoforge";
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
  type: "vanilla" | "forge" | "neoforge" | "unknown";
}
