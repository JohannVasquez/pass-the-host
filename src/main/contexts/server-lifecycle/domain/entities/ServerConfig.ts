export interface MinecraftServerConfig {
  serverName: string;
  version: string;
  serverType: "vanilla" | "forge";
}

export interface ServerCreationResult {
  success: boolean;
  error?: string;
}

export interface ServerDeletionResult {
  success: boolean;
  error?: string;
}
