import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { IServerLifecycleRepository } from "../../domain/repositories";
import {
  MinecraftServerConfig,
  ServerCreationResult,
  ServerDeletionResult,
} from "../../domain/entities";

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
        console.error(`Server ${config.serverName} already exists`);
        return { success: false, error: "Server already exists" };
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

      onProgress?.("Server created successfully!");
      return { success: true };
    } catch (error: any) {
      console.error(`Error creating server ${config.serverName}:`, error);
      return { success: false, error: error.message || "Unknown error" };
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
    } catch (error: any) {
      console.error(`Error deleting server ${serverId} locally:`, error);
      return { success: false, error: error.message || "Unknown error" };
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
    } catch (error) {
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

    const forgeUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-latest/forge-${version}-latest-installer.jar`;
    const forgeInstallerPath = path.join(serverPath, "forge-installer.jar");

    onProgress?.("Downloading Forge installer...");
    await this.downloadFile(forgeUrl, forgeInstallerPath);
    onProgress?.("Forge installer downloaded successfully");
  }

  private async getMinecraftServerJarUrl(version: string): Promise<string> {
    const manifestUrl = "https://piston-meta.mojang.com/mc/game/latest/launcher.json";

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
              const versionUrl = manifest.latest.release;

              https
                .get(versionUrl, (versionResponse) => {
                  let versionData = "";
                  versionResponse.on("data", (chunk) => {
                    versionData += chunk;
                  });
                  versionResponse.on("end", () => {
                    try {
                      const versionManifest = JSON.parse(versionData);
                      const versionInfo = versionManifest.versions.find(
                        (v: any) => v.id === version,
                      );

                      if (!versionInfo) {
                        reject(new Error(`Version ${version} not found`));
                        return;
                      }

                      https
                        .get(versionInfo.url, (fullResponse) => {
                          let fullData = "";
                          fullResponse.on("data", (chunk) => {
                            fullData += chunk;
                          });
                          fullResponse.on("end", () => {
                            try {
                              const fullManifest = JSON.parse(fullData);
                              const serverUrl = fullManifest.downloads.server.url;
                              resolve(serverUrl);
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
              https
                .get(response.headers.location, (redirectResponse) => {
                  redirectResponse.pipe(file);
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
                  } catch {}
                  reject(err);
                });
            } else {
              reject(new Error("Redirect without location"));
            }
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
          } catch {}
          reject(err);
        });
    });
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
