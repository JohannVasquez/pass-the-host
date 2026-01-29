import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { spawn } from "child_process";
import { IServerLifecycleRepository } from "../../domain/repositories";
import {
  MinecraftServerConfig,
  ServerCreationResult,
  ServerDeletionResult,
} from "../../domain/entities";
import { FileSystemError, NetworkError } from "@shared/domain/errors";

interface MinecraftVersionInfo {
  id: string;
  url: string;
}

const JAVA_RUNTIME_DIR = path.join(app.getPath("userData"), "java_runtime");

@injectable()
export class ServerLifecycleRepository implements IServerLifecycleRepository {
  async createServer(
    config: MinecraftServerConfig,
    onProgress?: (message: string) => void,
  ): Promise<ServerCreationResult> {
    try {
      const serverPath = this.getLocalServerPath(config.serverName);

      // Check if server already exists
      if (fs.existsSync(serverPath)) {
        if (!config.overwrite) {
          return {
            success: false,
            error: `Server ${config.serverName} already exists`,
            errorCode: "SERVER_EXISTS",
          };
        }
        // Delete existing server to overwrite
        onProgress?.("Deleting existing server...");
        fs.rmSync(serverPath, { recursive: true, force: true });
        onProgress?.("Existing server deleted");
      }

      // Create server directory
      fs.mkdirSync(serverPath, { recursive: true });
      onProgress?.("Creating server directory...");

      if (config.serverType === "vanilla") {
        await this.createVanillaServer(serverPath, config.version, onProgress);
      } else if (config.serverType === "forge") {
        await this.createForgeServer(serverPath, config.version, onProgress);
      }

      // Accept EULA
      const eulaPath = path.join(serverPath, "eula.txt");
      fs.writeFileSync(eulaPath, "eula=true\n", "utf-8");
      onProgress?.("EULA accepted");

      // Create server.properties
      this.createServerProperties(serverPath);
      onProgress?.("server.properties created");

      // Create server_info.json with version and type information
      this.createServerInfo(serverPath, config.version, config.serverType);
      onProgress?.("Server info saved");

      onProgress?.("Server created successfully!");
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (error instanceof NetworkError) {
        return {
          success: false,
          error: errorMessage,
          errorCode: "NETWORK_ERROR",
        };
      }

      if (error instanceof FileSystemError && errorMessage.includes("Java not found")) {
        return {
          success: false,
          error: errorMessage,
          errorCode: "JAVA_NOT_FOUND",
        };
      }

      return {
        success: false,
        error: `Failed to create server: ${errorMessage}`,
        errorCode: "UNKNOWN",
      };
    }
  }

  deleteServerLocally(serverId: string): ServerDeletionResult {
    try {
      const serverPath = this.getLocalServerPath(serverId);

      if (!fs.existsSync(serverPath)) {
        return { success: true }; // Already deleted or doesn't exist
      }

      // Delete the entire server directory
      fs.rmSync(serverPath, { recursive: true, force: true });

      return { success: true };
    } catch (error: unknown) {
      throw new FileSystemError(
        `Failed to delete server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getLocalServerPath(serverId: string): string {
    const localServersDir = path.join(app.getPath("userData"), "servers");
    return path.join(localServersDir, serverId);
  }

  private async createVanillaServer(
    serverPath: string,
    version: string,
    onProgress?: (message: string) => void,
  ): Promise<void> {
    onProgress?.(`Fetching Minecraft ${version} server information...`);
    let downloadUrl: string;

    try {
      downloadUrl = await this.getMinecraftServerJarUrl(version);
    } catch {
      // Fallback to latest release
      onProgress?.("Using latest release version...");
      downloadUrl =
        "https://launcher.mojang.com/v1/objects/a16d67e5807f57fc4e550c051f702f0b5ff0e8c9/server.jar";
    }

    const serverJarPath = path.join(serverPath, "server.jar");
    onProgress?.(`Downloading Minecraft ${version} server...`);

    await this.downloadFile(downloadUrl, serverJarPath);
    onProgress?.("Server JAR downloaded successfully");
  }

  private async createForgeServer(
    serverPath: string,
    version: string,
    onProgress?: (message: string) => void,
  ): Promise<void> {
    onProgress?.(`Setting up Forge ${version} server...`);

    // Get the recommended Forge version for this Minecraft version
    onProgress?.("Fetching Forge version information...");
    const forgeVersion = await this.getForgeVersion(version);

    if (!forgeVersion) {
      throw new NetworkError(`No Forge version found for Minecraft ${version}`);
    }

    onProgress?.(`Found Forge version: ${forgeVersion}`);

    // Forge installer URL format: https://maven.minecraftforge.net/net/minecraftforge/forge/{mcVersion}-{forgeVersion}/forge-{mcVersion}-{forgeVersion}-installer.jar
    const forgeUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-installer.jar`;
    const forgeInstallerPath = path.join(serverPath, "forge-installer.jar");

    onProgress?.("Downloading Forge installer...");
    await this.downloadFile(forgeUrl, forgeInstallerPath);
    onProgress?.("Forge installer downloaded successfully");

    // Get Java path for this Minecraft version
    const javaPath = this.getJavaPathForVersion(version);
    if (!javaPath || !fs.existsSync(javaPath)) {
      throw new FileSystemError(
        `Java not found for Minecraft ${version}. Please ensure Java is installed first.`,
      );
    }

    // Run the Forge installer in server mode
    onProgress?.("Installing Forge server (this may take a few minutes)...");
    await this.runForgeInstaller(javaPath, forgeInstallerPath, serverPath, onProgress);
    onProgress?.("Forge server installed successfully");

    // Clean up installer
    try {
      fs.unlinkSync(forgeInstallerPath);
      // Also clean up installer log if it exists
      const installerLogPath = path.join(serverPath, "forge-installer.jar.log");
      if (fs.existsSync(installerLogPath)) {
        fs.unlinkSync(installerLogPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Save forge version info for later reference
    const forgeInfoPath = path.join(serverPath, "forge_version.txt");
    fs.writeFileSync(forgeInfoPath, `${version}-${forgeVersion}`, "utf-8");
  }

  private getJavaPathForVersion(minecraftVersion: string): string | null {
    try {
      const versionParts = minecraftVersion.split(".");
      const major = parseInt(versionParts[0]);
      const minor = parseInt(versionParts[1]);

      let javaVersion: number;

      // Minecraft 1.19 and later -> Java 21
      if (major > 1 || (major === 1 && minor >= 19)) {
        javaVersion = 21;
      }
      // Minecraft 1.17 - 1.18.x -> Java 17
      else if (major === 1 && minor >= 17 && minor <= 18) {
        javaVersion = 17;
      }
      // Minecraft 1.12 - 1.16.5 -> Java 11
      else if (major === 1 && minor >= 12 && minor <= 16) {
        javaVersion = 11;
      }
      // Older versions -> Java 8
      else {
        javaVersion = 8;
      }

      const javaDir = path.join(JAVA_RUNTIME_DIR, `java${javaVersion}`);
      const isWindows = process.platform === "win32";
      const javaBinary = isWindows ? "java.exe" : "java";
      const javaPath = path.join(javaDir, "bin", javaBinary);

      return javaPath;
    } catch {
      return null;
    }
  }

  private async runForgeInstaller(
    javaPath: string,
    installerPath: string,
    serverPath: string,
    onProgress?: (message: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ["-jar", installerPath, "--installServer"];

      const installerProcess = spawn(javaPath, args, {
        cwd: serverPath,
        stdio: ["pipe", "pipe", "pipe"],
      });

      installerProcess.stdout.on("data", (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          // Filter out noisy messages, show only important ones
          if (
            message.includes("Downloading") ||
            message.includes("Installing") ||
            message.includes("Extracting") ||
            message.includes("Successfully")
          ) {
            onProgress?.(message);
          }
        }
      });

      installerProcess.stderr.on("data", (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          console.error("[Forge Installer]", message);
        }
      });

      installerProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Forge installer exited with code ${code}`));
        }
      });

      installerProcess.on("error", (error) => {
        reject(new Error(`Failed to run Forge installer: ${error.message}`));
      });
    });
  }

  private async getForgeVersion(minecraftVersion: string): Promise<string | null> {
    const promotionsUrl =
      "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";

    return new Promise((resolve, reject) => {
      https
        .get(promotionsUrl, (response) => {
          let data = "";
          response.on("data", (chunk) => {
            data += chunk;
          });
          response.on("end", () => {
            try {
              const promotions = JSON.parse(data);
              // Try to get recommended version first, then latest
              const recommendedKey = `${minecraftVersion}-recommended`;
              const latestKey = `${minecraftVersion}-latest`;

              if (promotions.promos[recommendedKey]) {
                resolve(promotions.promos[recommendedKey]);
              } else if (promotions.promos[latestKey]) {
                resolve(promotions.promos[latestKey]);
              } else {
                resolve(null);
              }
            } catch (e) {
              reject(e);
            }
          });
        })
        .on("error", reject);
    });
  }

  private async getMinecraftServerJarUrl(version: string): Promise<string> {
    // Official Minecraft version manifest
    const manifestUrl = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

    return new Promise((resolve, reject) => {
      https
        .get(manifestUrl, (response) => {
          let data = "";
          response.on("data", (chunk) => {
            data += chunk;
          });
          response.on("end", () => {
            try {
              const manifest = JSON.parse(data);
              // Find the specific version in the versions array
              const versionInfo = manifest.versions.find(
                (v: MinecraftVersionInfo) => v.id === version,
              );

              if (!versionInfo) {
                reject(new Error(`Version ${version} not found in Minecraft manifest`));
                return;
              }

              // Fetch the version-specific manifest to get server download URL
              https
                .get(versionInfo.url, (versionResponse) => {
                  let versionData = "";
                  versionResponse.on("data", (chunk) => {
                    versionData += chunk;
                  });
                  versionResponse.on("end", () => {
                    try {
                      const versionManifest = JSON.parse(versionData);
                      if (!versionManifest.downloads?.server?.url) {
                        reject(new Error(`Server download not available for version ${version}`));
                        return;
                      }
                      resolve(versionManifest.downloads.server.url);
                    } catch (e) {
                      reject(e);
                    }
                  });
                })
                .on("error", reject);
            } catch (e) {
              reject(e);
            }
          });
        })
        .on("error", reject);
    });
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      https
        .get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            file.close();
            if (response.headers.location) {
              this.downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
            } else {
              reject(new Error("Redirect without location"));
            }
            return;
          }

          // Check for HTTP errors
          if (response.statusCode && response.statusCode >= 400) {
            file.close();
            try {
              fs.unlinkSync(destPath);
            } catch {
              // Ignore unlink errors
            }
            reject(new Error(`HTTP Error ${response.statusCode}: Failed to download from ${url}`));
            return;
          }

          response.pipe(file);
          file.on("finish", () => {
            file.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        })
        .on("error", (err) => {
          file.close();
          try {
            fs.unlinkSync(destPath);
          } catch {
            // Ignore unlink errors
          }
          reject(err);
        });
    });
  }

  private createServerInfo(
    serverPath: string,
    version: string,
    serverType: "vanilla" | "forge",
  ): void {
    const serverInfoPath = path.join(serverPath, "server_info.json");
    const serverInfo = {
      version: version,
      type: serverType,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(serverInfoPath, JSON.stringify(serverInfo, null, 2), "utf-8");
  }

  private createServerProperties(serverPath: string): void {
    const serverPropertiesPath = path.join(serverPath, "server.properties");
    const defaultProperties = `#Minecraft server properties
#Generated by Pass the host
server-port=25565
gamemode=survival
difficulty=normal
max-players=20
online-mode=true
pvp=true
level-name=world
motd=A Minecraft Server
enable-command-block=false
spawn-protection=16
max-world-size=29999984
view-distance=10
simulation-distance=10
spawn-monsters=true
spawn-animals=true
spawn-npcs=true
allow-nether=true
`;
    fs.writeFileSync(serverPropertiesPath, defaultProperties, "utf-8");
  }
}
