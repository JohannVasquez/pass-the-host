import { injectable } from "inversify";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { IAppConfigurationRepository } from "@main/contexts/app-configuration/domain/repositories";
import { getDefaultRelativeJavaPath } from "@main/utils/javaRuntime";
import {
  S3Config,
  AppConfig,
  ConfigSaveResult,
} from "@main/contexts/app-configuration/domain/entities";
import { FileSystemError } from "@shared/domain/errors";

@injectable()
export class AppConfigurationRepository implements IAppConfigurationRepository {
  private createDefaultServerConfig(): NonNullable<AppConfig["server"]> {
    return {
      server_path: "./server_files",
      java_path: getDefaultRelativeJavaPath(),
      server_jar: "server.jar",
      server_type: "vanilla",
      memory_min: "2G",
      memory_max: "4G",
      server_port: 25565,
    };
  }

  private getConfigPath(): string {
    // Store config in userData directory so it persists and is writable
    return path.join(app.getPath("userData"), "config.json");
  }

  async loadConfig(): Promise<AppConfig | null> {
    const configPath = this.getConfigPath();
    try {
      if (fs.existsSync(configPath)) {
        const fileContent = JSON.parse(fs.readFileSync(configPath, "utf-8"));

        // Handle migration from r2 to s3 - check for s3 first, fallback to r2
        const s3Config = fileContent.s3 ||
          fileContent.r2 || {
            endpoint: "",
            access_key: "",
            secret_key: "",
            bucket_name: "",
            provider: "Cloudflare",
            region: "auto",
          };

        const appSettings = {
          owner_name: null,
          language: "en",
          cloud_sync_enabled: false,
          ...fileContent.app,
        };

        // Return the config with s3 property
        return {
          s3: s3Config,
          server: fileContent.server || this.createDefaultServerConfig(),
          app: appSettings,
        };
      } else {
        // Return default config if file doesn't exist yet
        return {
          s3: {
            endpoint: "",
            access_key: "",
            secret_key: "",
            bucket_name: "",
            provider: "Cloudflare",
            region: "auto",
          },
          server: this.createDefaultServerConfig(),
          app: {
            owner_name: null,
            language: "en",
            cloud_sync_enabled: false,
          },
        };
      }
    } catch (error) {
      // Unexpected error reading/parsing config file
      throw new FileSystemError(
        `Failed to read or parse config file: ${configPath}`,
        "FILESYSTEM_ERROR",
        error,
      );
    }
  }

  async saveS3Config(s3Config: S3Config): Promise<ConfigSaveResult> {
    const configPath = this.getConfigPath();
    try {
      let config: Partial<AppConfig> = {};

      // Try to read existing config
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } else {
        // Initialize default config structure if file doesn't exist
        config = {
          s3: {},
          server: this.createDefaultServerConfig(),
          app: {
            owner_name: null,
            language: "en",
            cloud_sync_enabled: false,
          },
        };
      }

      // Update S3 config (migrate from r2 to s3 if needed)
      config.s3 = { ...config.s3, ...s3Config };
      // Remove legacy r2 property if it exists
      if ("r2" in config) {
        delete config.r2;
      }

      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      return { success: true };
    } catch (e: unknown) {
      throw new FileSystemError(
        `Failed to save S3 config: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async saveCloudSyncEnabled(enabled: boolean): Promise<ConfigSaveResult> {
    const configPath = this.getConfigPath();
    try {
      let config: Partial<AppConfig> = {};

      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } else {
        config = {
          s3: {},
          server: this.createDefaultServerConfig(),
          app: {
            owner_name: null,
            language: "en",
            cloud_sync_enabled: false,
          },
        };
      }

      if (!config.app) {
        config.app = {};
      }

      config.app.cloud_sync_enabled = enabled;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      return { success: true };
    } catch (e: unknown) {
      throw new FileSystemError(
        `Failed to save cloud sync setting: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** @deprecated Use saveS3Config instead */
  async saveR2Config(r2Config: S3Config): Promise<ConfigSaveResult> {
    return this.saveS3Config(r2Config);
  }

  async saveUsername(username: string): Promise<ConfigSaveResult> {
    const configPath = this.getConfigPath();
    try {
      let config: Partial<AppConfig> = {};

      // Try to read existing config
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } else {
        // Initialize default config structure if file doesn't exist
        config = {
          s3: {
            endpoint: "",
            access_key: "",
            secret_key: "",
            bucket_name: "",
            provider: "Cloudflare",
            region: "auto",
          },
          server: this.createDefaultServerConfig(),
          app: {
            owner_name: null,
            language: "en",
            cloud_sync_enabled: false,
          },
        };
      }

      // Ensure app section exists
      if (!config.app) {
        config.app = {};
      }

      // Update username
      config.app.owner_name = username;

      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      return { success: true };
    } catch (e: unknown) {
      throw new FileSystemError(
        `Failed to save username: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async saveRamConfig(minRam: number, maxRam: number): Promise<ConfigSaveResult> {
    const configPath = this.getConfigPath();
    try {
      let config: Partial<AppConfig> = {};

      // Try to read existing config
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } else {
        // Initialize default config structure if file doesn't exist
        config = {
          s3: {
            endpoint: "",
            access_key: "",
            secret_key: "",
            bucket_name: "",
            provider: "Cloudflare",
            region: "auto",
          },
          server: this.createDefaultServerConfig(),
          app: {
            owner_name: null,
            language: "en",
            cloud_sync_enabled: false,
          },
        };
      }

      // Ensure server section exists
      if (!config.server) {
        config.server = this.createDefaultServerConfig();
      }

      // Update RAM config
      config.server.memory_min = `${minRam}G`;
      config.server.memory_max = `${maxRam}G`;

      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      return { success: true };
    } catch (e: unknown) {
      throw new FileSystemError(
        `Failed to save RAM config: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async saveLanguage(language: string): Promise<ConfigSaveResult> {
    const configPath = this.getConfigPath();
    try {
      let config: Partial<AppConfig> = {};

      // Try to read existing config
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } else {
        // Initialize default config structure if file doesn't exist
        config = {
          s3: {},
          server: {},
          app: {},
        };
      }

      // Ensure app section exists
      if (!config.app) {
        config.app = {};
      }

      // Update language
      config.app.language = language;

      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      return { success: true };
    } catch (e: unknown) {
      throw new FileSystemError(
        `Failed to save language: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
