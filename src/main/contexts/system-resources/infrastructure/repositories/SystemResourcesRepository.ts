import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { ISystemResourcesRepository } from "../../domain/repositories";
import {
  JavaVersion,
  JavaRequirement,
  JavaInstallationResult,
  SystemMemoryInfo,
  NetworkInterface,
} from "../../domain/entities";

const execAsync = promisify(exec);
const JAVA_RUNTIME_DIR = path.join(app.getPath("userData"), "java_runtime");

@injectable()
export class SystemResourcesRepository implements ISystemResourcesRepository {
  getInstalledJavaVersions(): JavaVersion[] {
    const versions: JavaVersion[] = [];

    if (!fs.existsSync(JAVA_RUNTIME_DIR)) {
      return versions;
    }

    const contents = fs.readdirSync(JAVA_RUNTIME_DIR);

    for (const item of contents) {
      const match = item.match(/^java(\d+)$/);
      if (match) {
        const versionNum = parseInt(match[1]);
        const javaPath = this.getJavaPath(versionNum);

        if (fs.existsSync(javaPath)) {
          versions.push({
            version: versionNum.toString(),
            path: javaPath,
          });
        }
      }
    }

    return versions;
  }

  getRequiredJavaVersion(minecraftVersion: string): JavaRequirement {
    try {
      const versionParts = minecraftVersion.split(".");
      const major = parseInt(versionParts[0]);
      const minor = parseInt(versionParts[1]);

      // Minecraft 1.19 and later -> Java 21
      if (major > 1 || (major === 1 && minor >= 19)) {
        return { minVersion: 21 };
      }

      // Minecraft 1.17 - 1.18.2 -> Java 17
      if (major === 1 && minor >= 17 && minor <= 18) {
        return { minVersion: 17 };
      }

      // Minecraft 1.12 - 1.16.5 -> Java 11
      if (major === 1 && minor >= 12 && minor <= 16) {
        return { minVersion: 11 };
      }

      // Minecraft 1.7.10 - 1.11.2 -> Java 8
      if (major === 1 && minor >= 7 && minor <= 11) {
        return { minVersion: 8 };
      }

      // Default to Java 21 for unknown versions
      return { minVersion: 21 };
    } catch (error) {
      console.error("Error parsing Minecraft version:", error);
      return { minVersion: 21 }; // Default to latest
    }
  }

  async ensureJavaForMinecraft(
    minecraftVersion: string,
    onProgress?: (message: string) => void,
  ): Promise<JavaInstallationResult> {
    try {
      const requiredJava = this.getRequiredJavaVersion(minecraftVersion);
      onProgress?.(`Minecraft ${minecraftVersion} requires Java ${requiredJava.minVersion}`);

      if (!this.isJavaInstalled(requiredJava.minVersion)) {
        onProgress?.(`Java ${requiredJava.minVersion} not found. Downloading...`);
        const downloadSuccess = await this.downloadJava(requiredJava.minVersion, onProgress);

        if (!downloadSuccess) {
          return {
            success: false,
            error: `Failed to download Java ${requiredJava.minVersion}`,
          };
        }
      } else {
        onProgress?.(`Java ${requiredJava.minVersion} is already installed`);
      }

      const javaPath = this.getJavaPath(requiredJava.minVersion);

      return {
        success: true,
        javaPath: javaPath,
        version: requiredJava.minVersion.toString(),
      };
    } catch (error: unknown) {
      console.error("Error ensuring Java for Minecraft:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getTotalMemory(): SystemMemoryInfo {
    const totalMemoryBytes = os.totalmem();
    const totalMemoryGB = Math.floor(totalMemoryBytes / 1024 ** 3);
    return { totalGB: totalMemoryGB };
  }

  getNetworkInterfaces(): NetworkInterface[] {
    const interfaces = os.networkInterfaces();
    const networkList: NetworkInterface[] = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;

      for (const addr of addresses) {
        // Filter only IPv4 addresses
        if (addr.family === "IPv4" && !addr.internal) {
          networkList.push({
            name: name,
            ip: addr.address,
          });
        }
      }
    }

    // Add localhost
    networkList.push({
      name: "Localhost",
      ip: "127.0.0.1",
    });

    return networkList;
  }

  // Private helper methods

  private getJavaPath(javaVersion: number): string {
    const javaDir = path.join(JAVA_RUNTIME_DIR, `java${javaVersion}`);
    const javaBin =
      process.platform === "win32"
        ? path.join(javaDir, "bin", "java.exe")
        : path.join(javaDir, "bin", "java");

    return javaBin;
  }

  private isJavaInstalled(javaVersion: number): boolean {
    const javaPath = this.getJavaPath(javaVersion);
    return fs.existsSync(javaPath);
  }

  private getJavaDownloadUrl(javaVersion: number): string {
    const platform = process.platform;
    const arch = process.arch;

    let osType: string;
    let archType: string;

    if (platform === "win32") {
      osType = "windows";
      archType = arch === "x64" ? "x64" : "x86";
    } else if (platform === "darwin") {
      osType = "mac";
      archType = arch === "arm64" ? "aarch64" : "x64";
    } else {
      osType = "linux";
      archType = arch === "x64" ? "x64" : arch === "arm64" ? "aarch64" : "x86";
    }

    const imageType = "jre";
    const heapSize = "normal";
    const vendor = "eclipse";

    // Adoptium API URL for latest release
    return `https://api.adoptium.net/v3/binary/latest/${javaVersion}/ga/${osType}/${archType}/${imageType}/hotspot/${heapSize}/${vendor}`;
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);

      const request = https.get(url, (response) => {
        // Handle redirects (301, 302, 307, 308)
        if (
          response.statusCode === 301 ||
          response.statusCode === 302 ||
          response.statusCode === 307 ||
          response.statusCode === 308
        ) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            if (fs.existsSync(dest)) {
              fs.unlinkSync(dest);
            }
            this.downloadFile(redirectUrl, dest).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(dest)) {
            fs.unlinkSync(dest);
          }
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });
      });

      request.on("error", (err) => {
        file.close();
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(err);
      });

      file.on("error", (err) => {
        file.close();
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(err);
      });
    });
  }

  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    const command =
      process.platform === "win32"
        ? `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`
        : `unzip -q "${zipPath}" -d "${destDir}"`;

    try {
      await execAsync(command);
    } catch (error) {
      throw new Error(`Failed to extract zip: ${error}`);
    }
  }

  private async extractTarGz(tarPath: string, destDir: string): Promise<void> {
    const command =
      process.platform === "win32"
        ? `tar -xzf "${tarPath}" -C "${destDir}"`
        : `tar -xzf "${tarPath}" -C "${destDir}"`;

    try {
      await execAsync(command);
    } catch (error) {
      throw new Error(`Failed to extract tar.gz: ${error}`);
    }
  }

  private async downloadJava(
    javaVersion: number,
    onProgress?: (message: string) => void,
  ): Promise<boolean> {
    try {
      onProgress?.(`Downloading Java ${javaVersion}...`);

      // Create java_runtime directory if it doesn't exist
      if (!fs.existsSync(JAVA_RUNTIME_DIR)) {
        fs.mkdirSync(JAVA_RUNTIME_DIR, { recursive: true });
      }

      const javaDir = path.join(JAVA_RUNTIME_DIR, `java${javaVersion}`);

      // Check if already installed
      if (this.isJavaInstalled(javaVersion)) {
        onProgress?.(`Java ${javaVersion} is already installed`);
        return true;
      }

      // Get download URL
      const downloadUrl = this.getJavaDownloadUrl(javaVersion);
      const ext = process.platform === "win32" ? "zip" : "tar.gz";
      const downloadPath = path.join(JAVA_RUNTIME_DIR, `java${javaVersion}.${ext}`);

      onProgress?.(`Downloading from Adoptium...`);

      // Download Java
      await this.downloadFile(downloadUrl, downloadPath);

      onProgress?.(`Extracting Java ${javaVersion}...`);

      // Create temp extraction directory
      const tempDir = path.join(JAVA_RUNTIME_DIR, `temp_java${javaVersion}`);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Extract the archive
      if (ext === "zip") {
        await this.extractZip(downloadPath, tempDir);
      } else {
        await this.extractTarGz(downloadPath, tempDir);
      }

      // Find the extracted JRE directory (usually has a version number in the name)
      const extractedContents = fs.readdirSync(tempDir);
      let jreDir: string | null = null;

      for (const item of extractedContents) {
        const itemPath = path.join(tempDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          // Check if this directory contains a bin folder
          const binPath = path.join(itemPath, "bin");
          if (fs.existsSync(binPath)) {
            jreDir = itemPath;
            break;
          }
        }
      }

      if (!jreDir) {
        throw new Error("Could not find JRE directory in extracted archive");
      }

      // Move the JRE directory to the final location
      if (fs.existsSync(javaDir)) {
        fs.rmSync(javaDir, { recursive: true, force: true });
      }
      fs.renameSync(jreDir, javaDir);

      // Clean up
      fs.unlinkSync(downloadPath);
      fs.rmSync(tempDir, { recursive: true, force: true });

      onProgress?.(`Java ${javaVersion} installed successfully`);

      return true;
    } catch (error) {
      console.error(`Error downloading Java ${javaVersion}:`, error);
      return false;
    }
  }
}
