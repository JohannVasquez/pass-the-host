import { injectable } from "inversify";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { IAppConfigurationRepository } from "../../domain/repositories";
import { R2Config, AppConfig, ConfigSaveResult } from "../../domain/entities";
import { FileSystemError } from "@shared/domain/errors";

@injectable()
export class AppConfigurationRepository implements IAppConfigurationRepository {
  private getConfigPath(): string {
    // Store config in userData directory so it persists and is writable
    return path.join(app.getPath("userData"), "config.json");
  }

  async loadConfig(): Promise<AppConfig | null> {
    const configPath = this.getConfigPath();
    try {
      if (fs.existsSync(configPath)) {
        const fileContent = JSON.parse(fs.readFileSync(configPath, "utf-8"));

        // Return the config as-is since it already matches the expected structure
        return {
          r2: fileContent.r2 || {
            endpoint: "",
            access_key: "",
            secret_key: "",
            bucket_name: "",
            region: "auto",
          },
          server: fileContent.server || {
            server_path: "./server_files",
            java_path: "./java_runtime/bin/java.exe",
            server_jar: "server.jar",
            server_type: "vanilla",
            memory_min: "2G",
            memory_max: "4G",
            server_port: 25565,
          },
          app: fileContent.app || {
            owner_name: null,
            language: "en",
          },
        };
      } else {
        // Return default config if file doesn't exist yet
        return {
          r2: {
            endpoint: "",
            access_key: "",
            secret_key: "",
            bucket_name: "",
            region: "auto",
          },
          server: {
            server_path: "./server_files",
            java_path: "./java_runtime/bin/java.exe",
            server_jar: "server.jar",
            server_type: "vanilla",
            memory_min: "2G",
            memory_max: "4G",
            server_port: 25565,
          },
          app: {
            owner_name: null,
            language: "en",
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

  async saveR2Config(r2Config: R2Config): Promise<ConfigSaveResult> {
    const configPath = this.getConfigPath();
    try {
      let config: Partial<AppConfig> = {};

      // Try to read existing config
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } else {
        // Initialize default config structure if file doesn't exist
        config = {
          r2: {},
          server: {
            server_path: "./server_files",
            java_path: "./java_runtime/bin/java.exe",
            server_jar: "server.jar",
            server_type: "vanilla",
            memory_min: "2G",
            memory_max: "4G",
            server_port: 25565,
          },
          app: {
            owner_name: null,
            language: "en",
          },
        };
      }

      // Update R2 config
      config.r2 = { ...config.r2, ...r2Config };

      // Write back to file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      return { success: true };
    } catch (e: unknown) {
      throw new FileSystemError(
        `Failed to save R2 config: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
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
          r2: {
            endpoint: "",
            access_key: "",
            secret_key: "",
            bucket_name: "",
          },
          server: {
            server_path: "./server_files",
            java_path: "./java_runtime/bin/java.exe",
            server_jar: "server.jar",
            server_type: "vanilla",
            memory_min: "2G",
            memory_max: "4G",
            server_port: 25565,
          },
          app: {
            owner_name: null,
            language: "en",
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
          r2: {
            endpoint: "",
            access_key: "",
            secret_key: "",
            bucket_name: "",
          },
          server: {
            server_path: "./server_files",
            java_path: "./java_runtime/bin/java.exe",
            server_jar: "server.jar",
            server_type: "vanilla",
            memory_min: "2G",
            memory_max: "4G",
            server_port: 25565,
          },
          app: {
            owner_name: null,
            language: "en",
          },
        };
      }

      // Ensure server section exists
      if (!config.server) {
        config.server = {
          server_path: "./server_files",
          java_path: "./java_runtime/bin/java.exe",
          server_jar: "server.jar",
          server_type: "vanilla",
          memory_min: "2G",
          memory_max: "4G",
          server_port: 25565,
        };
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
          r2: {},
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
