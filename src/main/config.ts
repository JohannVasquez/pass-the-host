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
          owner_name: "YourName",
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
          owner_name: "YourName",
        },
      };
    }

    // Update R2 config
    config.r2 = { ...config.r2, ...r2Config };

    // Write back to file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    console.log("R2 config saved successfully to:", configPath);
    return true;
  } catch (e) {
    console.error("Failed to save R2 config:", e);
    return false;
  }
}
