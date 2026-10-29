import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { spawn } from "child_process";
import { IServerLifecycleRepository } from "@main/contexts/server-lifecycle/domain/repositories";
import { findBundledJavaPath, getRequiredJavaMajor } from "@main/utils/javaRuntime";
import {
  getFabricInstallerVersion,
  getPaperBuilds,
  getQuiltInstallerVersion,
  getUserAgent,
  httpGetText,
  listEngineVersions,
} from "./EngineCatalog";
import {
  EngineType,
  LocalServerInfo,
  MinecraftServerConfig,
  ServerCreationResult,
  ServerDeletionResult,
} from "@main/contexts/server-lifecycle/domain/entities";

interface StoredServerInfo {
  name?: string;
  version?: string;
  type?: EngineType | "unknown";
  loaderVersion?: string;
}
import { FileSystemError, NetworkError } from "@shared/domain/errors";

interface MinecraftVersionInfo {
  id: string;
  url: string;
}

interface InstallResult {
  /** Jar the server is started with; absent when a Forge/NeoForge run script is used */
  launchJar?: string;
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

      const engineVersion =
        config.serverType === "vanilla"
          ? undefined
          : (config.engineVersion ?? (await this.resolveRecommended(config)));

      let install: InstallResult = {};
      switch (config.serverType) {
        case "vanilla":
          install = await this.createVanillaServer(serverPath, config.version, onProgress);
          break;
        case "paper":
          install = await this.createPaperServer(
            serverPath,
            config.version,
            engineVersion!,
            onProgress,
          );
          break;
        case "fabric":
          install = await this.createFabricServer(
            serverPath,
            config.version,
            engineVersion!,
            onProgress,
          );
          break;
        case "quilt":
          install = await this.createQuiltServer(
            serverPath,
            config.version,
            engineVersion!,
            onProgress,
          );
          break;
        case "forge":
          install = await this.createForgeServer(
            serverPath,
            config.version,
            engineVersion!,
            onProgress,
          );
          break;
        case "neoforge":
          install = await this.createNeoForgeServer(
            serverPath,
            config.version,
            engineVersion!,
            onProgress,
          );
          break;
        default:
          throw new Error(`Unsupported server type: ${String(config.serverType)}`);
      }

      // Accept EULA
      const eulaPath = path.join(serverPath, "eula.txt");
      fs.writeFileSync(eulaPath, "eula=true\n", "utf-8");
      onProgress?.("EULA accepted");

      // Create server.properties
      this.createServerProperties(serverPath);
      onProgress?.("server.properties created");

      // Create server_info.json with version and type information
      this.createServerInfo(
        serverPath,
        config.displayName ?? config.serverName,
        config.version,
        config.serverType,
        engineVersion,
        install.launchJar,
      );
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

  listLocalServers(): LocalServerInfo[] {
    const localServersDir = path.join(app.getPath("userData"), "servers");

    if (!fs.existsSync(localServersDir)) {
      return [];
    }

    try {
      return fs
        .readdirSync(localServersDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const serverId = entry.name;
          const serverInfoPath = path.join(localServersDir, serverId, "server_info.json");
          let storedInfo: StoredServerInfo = {};

          if (fs.existsSync(serverInfoPath)) {
            storedInfo = JSON.parse(fs.readFileSync(serverInfoPath, "utf-8")) as StoredServerInfo;
          }

          return {
            id: serverId,
            name: storedInfo.name || serverId,
            version: storedInfo.version || "unknown",
            type: storedInfo.type || "unknown",
            loaderVersion: storedInfo.loaderVersion,
          };
        });
    } catch (error: unknown) {
      throw new FileSystemError(
        `Failed to list local servers: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getLocalServerPath(serverId: string): string {
    const localServersDir = path.join(app.getPath("userData"), "servers");
    return path.join(localServersDir, serverId);
  }

  private async resolveRecommended(config: MinecraftServerConfig): Promise<string> {
    const { recommended } = await listEngineVersions(config.serverType, config.version);
    if (!recommended) {
      throw new NetworkError(`No ${config.serverType} version found for Minecraft ${config.version}`);
    }
    return recommended;
  }

  private async createVanillaServer(
    serverPath: string,
    version: string,
    onProgress?: (message: string) => void,
  ): Promise<InstallResult> {
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
    return { launchJar: "server.jar" };
  }

  private async createPaperServer(
    serverPath: string,
    version: string,
    build: string,
    onProgress?: (message: string) => void,
  ): Promise<InstallResult> {
    onProgress?.(`Setting up Paper ${version} (build ${build}) server...`);
    const builds = await getPaperBuilds(version);
    const url = builds.find((b) => String(b.id) === build)?.downloads["server:default"]?.url;
    if (!url) {
      throw new NetworkError(`Paper build ${build} not found for Minecraft ${version}`);
    }

    onProgress?.("Downloading Paper server...");
    await this.downloadFile(url, path.join(serverPath, "paper.jar"));
    fs.mkdirSync(path.join(serverPath, "plugins"), { recursive: true });
    onProgress?.("Paper server downloaded successfully");
    return { launchJar: "paper.jar" };
  }

  private async createFabricServer(
    serverPath: string,
    version: string,
    loaderVersion: string,
    onProgress?: (message: string) => void,
  ): Promise<InstallResult> {
    onProgress?.(`Setting up Fabric ${loaderVersion} server for Minecraft ${version}...`);
    const installerVersion = await getFabricInstallerVersion();

    // Fabric's server launcher fetches the vanilla server.jar itself on first launch
    const url = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/${installerVersion}/server/jar`;
    onProgress?.("Downloading Fabric server launcher...");
    await this.downloadFile(url, path.join(serverPath, "fabric-server-launch.jar"));
    fs.mkdirSync(path.join(serverPath, "mods"), { recursive: true });
    onProgress?.("Fabric server launcher downloaded successfully");
    return { launchJar: "fabric-server-launch.jar" };
  }

  private async createQuiltServer(
    serverPath: string,
    version: string,
    loaderVersion: string,
    onProgress?: (message: string) => void,
  ): Promise<InstallResult> {
    onProgress?.(`Setting up Quilt ${loaderVersion} server for Minecraft ${version}...`);
    const installerVersion = await getQuiltInstallerVersion();
    const installerPath = path.join(serverPath, "quilt-installer.jar");

    onProgress?.("Downloading Quilt installer...");
    await this.downloadFile(
      `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/${installerVersion}/quilt-installer-${installerVersion}.jar`,
      installerPath,
    );

    const javaPath = this.requireJava(version);
    onProgress?.("Installing Quilt server (this may take a few minutes)...");
    await this.runInstallerJar(
      javaPath,
      installerPath,
      serverPath,
      [
        "install",
        "server",
        version,
        loaderVersion,
        "--download-server",
        `--install-dir=${serverPath}`,
      ],
      onProgress,
    );
    this.removeInstaller(installerPath);
    fs.mkdirSync(path.join(serverPath, "mods"), { recursive: true });
    onProgress?.("Quilt server installed successfully");
    return { launchJar: "quilt-server-launch.jar" };
  }

  private async createForgeServer(
    serverPath: string,
    version: string,
    forgeId: string,
    onProgress?: (message: string) => void,
  ): Promise<InstallResult> {
    onProgress?.(`Setting up Forge ${forgeId} server...`);

    // forgeId is the full maven version, e.g. 1.20.1-47.3.0
    const forgeUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeId}/forge-${forgeId}-installer.jar`;
    const forgeInstallerPath = path.join(serverPath, "forge-installer.jar");

    onProgress?.("Downloading Forge installer...");
    await this.downloadFile(forgeUrl, forgeInstallerPath);
    onProgress?.("Forge installer downloaded successfully");

    const javaPath = this.requireJava(version);
    onProgress?.("Installing Forge server (this may take a few minutes)...");
    await this.runInstallerJar(
      javaPath,
      forgeInstallerPath,
      serverPath,
      ["--installServer"],
      onProgress,
    );
    onProgress?.("Forge server installed successfully");
    this.removeInstaller(forgeInstallerPath);

    // Save forge version info for later reference
    fs.writeFileSync(path.join(serverPath, "forge_version.txt"), forgeId, "utf-8");

    // 1.17+ ships run.sh/run.bat; older Forge produces a jar to launch directly
    if (fs.existsSync(path.join(serverPath, "run.sh")) || fs.existsSync(path.join(serverPath, "run.bat"))) {
      return {};
    }
    const forgeJar = fs
      .readdirSync(serverPath)
      .find((f) => f.startsWith("forge-") && f.endsWith(".jar") && !f.includes("installer"));
    if (!forgeJar) {
      throw new Error("Forge installer did not produce a server jar");
    }
    return { launchJar: forgeJar };
  }

  private async createNeoForgeServer(
    serverPath: string,
    version: string,
    neoForgeId: string,
    onProgress?: (message: string) => void,
  ): Promise<InstallResult> {
    onProgress?.(`Setting up NeoForge ${neoForgeId} server...`);

    // NeoForge for 1.20.1 lives under the old "forge" artifact
    const artifact = version === "1.20.1" ? "forge" : "neoforge";
    const neoForgeUrl = `https://maven.neoforged.net/releases/net/neoforged/${artifact}/${neoForgeId}/${artifact}-${neoForgeId}-installer.jar`;
    const neoForgeInstallerPath = path.join(serverPath, "neoforge-installer.jar");

    onProgress?.("Downloading NeoForge installer...");
    await this.downloadFile(neoForgeUrl, neoForgeInstallerPath);
    onProgress?.("NeoForge installer downloaded successfully");

    const javaPath = this.requireJava(version);
    onProgress?.("Installing NeoForge server (this may take a few minutes)...");
    await this.runInstallerJar(
      javaPath,
      neoForgeInstallerPath,
      serverPath,
      ["--installServer"],
      onProgress,
    );
    onProgress?.("NeoForge server installed successfully");
    this.removeInstaller(neoForgeInstallerPath);

    // Save neoforge version info for later reference
    fs.writeFileSync(path.join(serverPath, "neoforge_version.txt"), neoForgeId, "utf-8");
    return {};
  }

  private requireJava(minecraftVersion: string): string {
    const javaPath = this.getJavaPathForVersion(minecraftVersion);
    if (!javaPath || !fs.existsSync(javaPath)) {
      throw new FileSystemError(
        `Java not found for Minecraft ${minecraftVersion}. Please ensure Java is installed first.`,
      );
    }
    return javaPath;
  }

  private removeInstaller(installerPath: string): void {
    try {
      fs.unlinkSync(installerPath);
      // Also clean up installer log if it exists
      const installerLogPath = `${installerPath}.log`;
      if (fs.existsSync(installerLogPath)) {
        fs.unlinkSync(installerLogPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private getJavaPathForVersion(minecraftVersion: string): string | null {
    try {
      const javaDir = path.join(JAVA_RUNTIME_DIR, `java${getRequiredJavaMajor(minecraftVersion)}`);
      return findBundledJavaPath(javaDir, fs.existsSync);
    } catch {
      return null;
    }
  }

  private async runInstallerJar(
    javaPath: string,
    installerPath: string,
    serverPath: string,
    installerArgs: string[],
    onProgress?: (message: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ["-jar", installerPath, ...installerArgs];

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
          console.error("[Installer]", message);
        }
      });

      installerProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Installer exited with code ${code}`));
        }
      });

      installerProcess.on("error", (error) => {
        reject(new Error(`Failed to run installer: ${error.message}`));
      });
    });
  }

  private async getMinecraftServerJarUrl(version: string): Promise<string> {
    const manifest = JSON.parse(
      await httpGetText("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"),
    ) as { versions: MinecraftVersionInfo[] };
    const versionInfo = manifest.versions.find((v) => v.id === version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found in Minecraft manifest`);
    }

    // The version-specific manifest has the server download URL
    const versionManifest = JSON.parse(await httpGetText(versionInfo.url));
    if (!versionManifest.downloads?.server?.url) {
      throw new Error(`Server download not available for version ${version}`);
    }
    return versionManifest.downloads.server.url;
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    const headers = { "User-Agent": await getUserAgent() };
    return new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      https
        .get(url, { headers }, (response) => {
          // Handle redirects
          if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
            file.close();
            response.resume();
            if (response.headers.location) {
              const next = new URL(response.headers.location, url).toString();
              this.downloadFile(next, destPath).then(resolve).catch(reject);
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
    name: string,
    version: string,
    serverType: EngineType,
    loaderVersion?: string,
    launchJar?: string,
  ): void {
    const serverInfoPath = path.join(serverPath, "server_info.json");
    const serverInfo = {
      name,
      version: version,
      type: serverType,
      ...(loaderVersion && { loaderVersion }),
      ...(launchJar && { launchJar }),
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
