import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

export function getConfigPath(): string {
  // Store config in userData directory so it persists and is writable
  return path.join(app.getPath("userData"), "config.json");
}

export function loadConfig(): any {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
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
  } catch (e) {
    console.error("Failed to load config:", e);
    return null;
  }
}

export function saveR2Config(r2Config: any): boolean {
  const configPath = getConfigPath();
  try {
    let config: any = {};

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

    return true;
  } catch (e) {
    console.error("Failed to save R2 config:", e);
    return false;
  }
}

export function saveUsername(username: string): boolean {
  const configPath = getConfigPath();
  try {
    let config: any = {};

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

    return true;
  } catch (e) {
    console.error("Failed to save username:", e);
    return false;
  }
}

export function saveRamConfig(minRam: number, maxRam: number): boolean {
  const configPath = getConfigPath();
  try {
    let config: any = {};

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

    return true;
  } catch (e) {
    console.error("Failed to save RAM config:", e);
    return false;
  }
}

export function saveLanguage(language: string): boolean {
  const configPath = getConfigPath();
  try {
    let config: any = {};

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

    return true;
  } catch (e) {
    console.error("Failed to save language:", e);
    return false;
  }
}

export function getLanguage(): string {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return config.app?.language || "en";
    }
    return "en"; // Default language
  } catch (e) {
    console.error("Failed to get language:", e);
    return "en";
  }
}
