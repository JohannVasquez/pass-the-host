import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { execSync, exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let isInstalling = false;

const RCLONE_VERSION = "v1.65.0";
const RCLONE_DIR = path.join(app.getPath("userData"), "rclone");
const RCLONE_EXECUTABLE = process.platform === "win32" ? "rclone.exe" : "rclone";
const RCLONE_PATH = path.join(RCLONE_DIR, RCLONE_EXECUTABLE);
const RCLONE_CONFIG_NAME = "pass-the-host-r2";

interface R2Config {
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}

/**
 * Ensures rclone is configured with R2 credentials
 * Reusable helper function for all R2 operations
 */
async function ensureRcloneConfigured(config: R2Config): Promise<void> {
  const configCommand = `"${RCLONE_PATH}" config create ${RCLONE_CONFIG_NAME} s3 provider=Cloudflare access_key_id=${config.access_key} secret_access_key=${config.secret_key} endpoint=${config.endpoint} acl=private --non-interactive`;

  try {
    await execAsync(configCommand);
  } catch (error) {
    // Config might already exist, continue
  }
}

function getRcloneDownloadUrl(): string {
  const platform = process.platform;
  const arch = process.arch;

  let osType: string;
  let archType: string;

  if (platform === "win32") {
    osType = "windows";
    archType = arch === "x64" ? "amd64" : "386";
  } else if (platform === "darwin") {
    osType = "osx";
    archType = arch === "arm64" ? "arm64" : "amd64";
  } else {
    osType = "linux";
    archType = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : "386";
  }

  const fileName = `rclone-${RCLONE_VERSION}-${osType}-${archType}.zip`;
  return `https://downloads.rclone.org/${RCLONE_VERSION}/${fileName}`;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          file.close();
          if (response.headers.location) {
            downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
          } else {
            reject(new Error("Redirect without location header"));
          }
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close((err) => {
            if (err) {
              reject(err);
            } else {
              // Wait a bit to ensure file is fully released
              setTimeout(() => resolve(), 500);
            }
          });
        });
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (process.platform === "win32") {
    // Use PowerShell to extract on Windows
    const command = `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
    execSync(command);
  } else {
    // Use unzip on Unix-based systems
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`);
  }
}

export async function checkRcloneInstallation(): Promise<boolean> {
  try {
    return fs.existsSync(RCLONE_PATH);
  } catch (error) {
    console.error("Error checking rclone installation:", error);
    return false;
  }
}

export async function installRclone(onProgress?: (message: string) => void): Promise<boolean> {
  // Prevent concurrent installations
  if (isInstalling) {
    onProgress?.("Rclone installation already in progress...");
    // Wait for current installation to complete
    let attempts = 0;
    while (isInstalling && attempts < 60) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }
    return await checkRcloneInstallation();
  }

  isInstalling = true;

  try {
    onProgress?.("Preparing to download rclone...");

    // Create rclone directory if it doesn't exist
    if (!fs.existsSync(RCLONE_DIR)) {
      fs.mkdirSync(RCLONE_DIR, { recursive: true });
    }

    const downloadUrl = getRcloneDownloadUrl();
    const zipPath = path.join(RCLONE_DIR, "rclone.zip");

    onProgress?.("Downloading rclone...");

    // Download rclone
    await downloadFile(downloadUrl, zipPath);

    onProgress?.("Extracting rclone...");

    // Extract zip
    await extractZip(zipPath, RCLONE_DIR);

    // Find the rclone executable in the extracted folder
    const platform = process.platform;
    const arch = process.arch;
    let osType: string;
    let archType: string;

    if (platform === "win32") {
      osType = "windows";
      archType = arch === "x64" ? "amd64" : "386";
    } else if (platform === "darwin") {
      osType = "osx";
      archType = arch === "arm64" ? "arm64" : "amd64";
    } else {
      osType = "linux";
      archType = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : "386";
    }

    const extractedDir = path.join(RCLONE_DIR, `rclone-${RCLONE_VERSION}-${osType}-${archType}`);
    const extractedExecutable = path.join(extractedDir, RCLONE_EXECUTABLE);

    // Move the executable to the rclone directory
    if (fs.existsSync(extractedExecutable)) {
      onProgress?.("Finalizing installation...");
      fs.copyFileSync(extractedExecutable, RCLONE_PATH);

      // Make executable on Unix-based systems
      if (process.platform !== "win32") {
        fs.chmodSync(RCLONE_PATH, 0o755);
      }

      // Clean up
      fs.unlinkSync(zipPath);
      fs.rmSync(extractedDir, { recursive: true, force: true });

      onProgress?.("Rclone installed successfully");
      return true;
    } else {
      throw new Error("Rclone executable not found in extracted files");
    }
  } catch (error) {
    console.error("Error installing rclone:", error);
    onProgress?.("Failed to install rclone");
    return false;
  } finally {
    isInstalling = false;
  }
}

export async function testR2Connection(config: {
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}): Promise<boolean> {
  try {
    // Ensure rclone is configured
    await ensureRcloneConfigured(config);

    // Test connection by listing the bucket
    const testCommand = `"${RCLONE_PATH}" lsd ${RCLONE_CONFIG_NAME}:${config.bucket_name}`;
    await execAsync(testCommand);

    return true;
  } catch (error) {
    console.error("Error testing R2 connection:", error);
    return false;
  }
}

/**
 * Lists all server directories in the pass_the_host folder from R2
 */
export async function listR2Servers(config: {
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}): Promise<Array<{ id: string; name: string; version: string; type: string }>> {
  try {
    // Ensure rclone is configured
    await ensureRcloneConfigured(config);

    // List directories in pass_the_host folder
    const listCommand = `"${RCLONE_PATH}" lsf ${RCLONE_CONFIG_NAME}:${config.bucket_name}/pass_the_host --dirs-only`;
    const { stdout } = await execAsync(listCommand);

    const serverDirs = stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.replace(/\/$/, "")); // Remove trailing slash

    // For each server directory, try to detect version and type
    const servers = await Promise.all(
      serverDirs.map(async (serverName) => {
        const serverPath = `${RCLONE_CONFIG_NAME}:${config.bucket_name}/pass_the_host/${serverName}`;

        // Try to detect server type and version
        const { version, type } = await detectServerVersionAndType(serverPath, serverName);

        return {
          id: serverName,
          name: serverName,
          version: version,
          type: type,
        };
      })
    );

    return servers;
  } catch (error) {
    console.error("Error listing R2 servers:", error);
    return [];
  }
}

/**
 * Detects server version and type by examining files
 */
async function detectServerVersionAndType(
  serverPath: string,
  serverName: string
): Promise<{ version: string; type: string }> {
  try {
    // List all files in the server directory
    const listCommand = `"${RCLONE_PATH}" lsf ${serverPath}`;
    const { stdout } = await execAsync(listCommand);

    const files = stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "");

    // Check for Forge by looking in libraries/net/minecraftforge/forge/ directory
    const hasLibrariesFolder = files.some((file) => file.startsWith("libraries/"));

    if (hasLibrariesFolder) {
      try {
        // List the forge version directories
        const forgePathCommand = `"${RCLONE_PATH}" lsf ${serverPath}/libraries/net/minecraftforge/forge/ --dirs-only`;
        const { stdout: forgeStdout } = await execAsync(forgePathCommand);

        const forgeVersionDirs = forgeStdout
          .trim()
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => line.replace(/\/$/, "")); // Remove trailing slash

        if (forgeVersionDirs.length > 0) {
          // Get the first version directory (e.g., "1.20.1-47.3.12")
          const versionDir = forgeVersionDirs[0];
          // Extract just the minecraft version (first part before dash)
          const versionMatch = versionDir.match(/^(\d+\.\d+(?:\.\d+)?)/);
          if (versionMatch) {
            return { version: versionMatch[1], type: "forge" };
          }
          return { version: versionDir, type: "forge" };
        }
      } catch (error) {
        console.error("Error checking forge version:", error);
        // Fallback to checking for forge jar
      }
    }

    // Fallback: Check for Forge jar file
    const forgeJar = files.find((file) => file.includes("forge") && file.endsWith(".jar"));
    if (forgeJar) {
      const versionMatch = forgeJar.match(/forge[.-](\d+\.\d+(?:\.\d+)?)/);
      if (versionMatch) {
        return { version: versionMatch[1], type: "forge" };
      }
      return { version: "Unknown", type: "forge" };
    }

    // Check for vanilla server by looking in versions/ directory
    const hasVersionsFolder = files.some((file) => file.startsWith("versions/"));

    if (hasVersionsFolder) {
      try {
        // List the version directories
        const versionPathCommand = `"${RCLONE_PATH}" lsf ${serverPath}/versions/ --dirs-only`;
        const { stdout: versionStdout } = await execAsync(versionPathCommand);

        const versionDirs = versionStdout
          .trim()
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => line.replace(/\/$/, "")); // Remove trailing slash

        if (versionDirs.length > 0) {
          // Get the first version directory (e.g., "1.21.8")
          const version = versionDirs[0];
          return { version: version, type: "vanilla" };
        }
      } catch (error) {
        console.error("Error checking vanilla version:", error);
      }
    }

    // Fallback: Check for server.jar
    const hasServerJar = files.some((file) => file === "server.jar");
    if (hasServerJar) {
      return { version: "Unknown", type: "vanilla" };
    }

    return { version: "Unknown", type: "unknown" };
  } catch (error) {
    console.error(`Error detecting version for ${serverName}:`, error);
    return { version: "Unknown", type: "unknown" };
  }
}

/**
 * Downloads/syncs a server from R2 to local storage
 * Deletes existing local files before downloading to avoid outdated files
 */
export async function downloadServerFromR2(
  config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  },
  serverId: string,
  onProgress?: (percent: number, transferred: string, total: string) => void
): Promise<boolean> {
  try {
    // Ensure rclone is configured
    await ensureRcloneConfigured(config);

    const localServersDir = path.join(app.getPath("userData"), "servers");
    const localServerPath = path.join(localServersDir, serverId);
    const r2ServerPath = `${RCLONE_CONFIG_NAME}:${config.bucket_name}/pass_the_host/${serverId}`;

    if (!fs.existsSync(localServersDir)) fs.mkdirSync(localServersDir, { recursive: true });
    if (fs.existsSync(localServerPath))
      fs.rmSync(localServerPath, { recursive: true, force: true });
    fs.mkdirSync(localServerPath, { recursive: true });

    onProgress?.(0, "0", "0");

    return new Promise<boolean>((resolve, reject) => {
      const rcloneProcess = spawn(
        RCLONE_PATH,
        ["sync", r2ServerPath, localServerPath, "--progress", "--stats", "1s", "--transfers", "8"],
        { shell: true }
      );

      let lastProgress = "";
      let outputBuffer = ""; // Buffer para acumular texto fragmentado

      rcloneProcess.stderr.on("data", (data: Buffer) => {
        outputBuffer += data.toString();

        // Dividir por saltos de línea (incluyendo retornos de carro de rclone)
        const lines = outputBuffer.split(/[\r\n]+/);

        // El último elemento puede ser una línea incompleta, guardarla en el buffer para después
        outputBuffer = lines.pop() || "";

        for (const line of lines) {
          // Regex más robusto: busca "Transferred:", luego algo hasta el /, luego algo hasta la coma
          const match = line.match(/Transferred:\s*([^\/]+)\s*\/\s*([^,]+),\s*(\d+)%/);

          if (match) {
            const transferred = match[1].trim();
            const total = match[2].trim();
            const percent = parseInt(match[3]);

            const currentProgress = JSON.stringify({ transferred, percent });
            if (currentProgress !== lastProgress) {
              lastProgress = currentProgress;
              onProgress?.(percent, transferred, total);
            }
          }
        }
      });

      rcloneProcess.on("close", (code) => {
        if (code === 0) {
          onProgress?.(100, "Complete", "Complete");
          resolve(true);
        } else {
          reject(new Error(`Download failed with code ${code}`));
        }
      });
      rcloneProcess.on("error", (error) => reject(error));
    });
  } catch (error) {
    console.error(`Error downloading server ${serverId} from R2:`, error);
    return false;
  }
}

/**
 * Gets the local path for a server
 */
export function getLocalServerPath(serverId: string): string {
  const localServersDir = path.join(app.getPath("userData"), "servers");
  return path.join(localServersDir, serverId);
}

/**
 * Reads the server.lock file from R2 and returns its content
 */
export async function readServerLock(
  config: R2Config,
  serverId: string
): Promise<{
  exists: boolean;
  username?: string;
  startedAt?: string;
  timestamp?: number;
}> {
  try {
    const r2LockPath = `${RCLONE_CONFIG_NAME}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

    // Try to read the lock file from R2 using async exec
    const catCommand = `"${RCLONE_PATH}" cat ${r2LockPath}`;

    const { stdout } = await execAsync(catCommand, { maxBuffer: 1024 * 1024 });

    // Parse the lock content
    const lockContent = JSON.parse(stdout.trim());

    return {
      exists: true,
      username: lockContent.username,
      startedAt: lockContent.startedAt,
      timestamp: lockContent.timestamp,
    };
  } catch (error: any) {
    return { exists: false };
  }
}

/**
 * Creates a server.lock file with username and timestamp
 */
export function createServerLock(serverId: string, username: string): boolean {
  try {
    const serverPath = getLocalServerPath(serverId);
    const lockFilePath = path.join(serverPath, "server.lock");

    // Check if server directory exists
    if (!fs.existsSync(serverPath)) {
      console.error(`Server directory not found: ${serverPath}`);
      return false;
    }

    // Create lock content
    const lockContent = {
      username: username,
      startedAt: new Date().toISOString(),
      timestamp: Date.now(),
    };

    // Write lock file
    fs.writeFileSync(lockFilePath, JSON.stringify(lockContent, null, 2), "utf-8");

    return true;
  } catch (error) {
    console.error(`Error creating server lock for ${serverId}:`, error);
    return false;
  }
}

/**
 * Uploads the server.lock file to R2
 */
export async function uploadServerLock(
  config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  },
  serverId: string
): Promise<boolean> {
  try {
    // Ensure rclone is configured
    await ensureRcloneConfigured(config);

    // Define paths
    const serverPath = getLocalServerPath(serverId);
    const lockFilePath = path.join(serverPath, "server.lock");
    const r2LockPath = `${RCLONE_CONFIG_NAME}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

    // Check if lock file exists
    if (!fs.existsSync(lockFilePath)) {
      console.error(`Lock file not found: ${lockFilePath}`);
      return false;
    }

    // Copy the lock file to R2
    const copyCommand = `"${RCLONE_PATH}" copyto "${lockFilePath}" ${r2LockPath}`;

    await execAsync(copyCommand, { maxBuffer: 1024 * 1024 });

    return true;
  } catch (error) {
    console.error(`Error uploading server lock for ${serverId}:`, error);
    return false;
  }
}

/**
 * Deletes the server.lock file from local storage
 */
export function deleteLocalServerLock(serverId: string): { success: boolean; existed: boolean } {
  try {
    const serverPath = getLocalServerPath(serverId);
    const lockFilePath = path.join(serverPath, "server.lock");

    // Check if lock file exists
    if (!fs.existsSync(lockFilePath)) {
      return { success: true, existed: false }; // Not an error if file doesn't exist
    }

    // Delete the lock file
    fs.unlinkSync(lockFilePath);

    return { success: true, existed: true };
  } catch (error) {
    console.error(`Error deleting local server lock for ${serverId}:`, error);
    return { success: false, existed: true };
  }
}

/**
 * Deletes the server.lock file from R2
 */
export async function deleteServerLock(
  config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  },
  serverId: string
): Promise<{ success: boolean; existed: boolean }> {
  try {
    // Ensure rclone is configured
    await ensureRcloneConfigured(config);

    const r2LockPath = `${RCLONE_CONFIG_NAME}:${config.bucket_name}/pass_the_host/${serverId}/server.lock`;

    // Check if file exists first
    const checkCommand = `"${RCLONE_PATH}" ls ${r2LockPath}`;
    try {
      await execAsync(checkCommand, { maxBuffer: 1024 * 1024 });
    } catch (error) {
      // File doesn't exist
      return { success: true, existed: false };
    }

    // Delete the lock file from R2
    const deleteCommand = `"${RCLONE_PATH}" deletefile ${r2LockPath}`;

    await execAsync(deleteCommand, { maxBuffer: 1024 * 1024 });

    return { success: true, existed: true };
  } catch (error) {
    console.error(`Error deleting server lock for ${serverId}:`, error);
    return { success: false, existed: true };
  }
}

/**
 * Uploads/syncs a server from local storage to R2
 */
export async function uploadServerToR2(
  config: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
  },
  serverId: string,
  onProgress?: (percent: number, transferred: string, total: string) => void
): Promise<boolean> {
  try {
    // Ensure rclone is configured
    await ensureRcloneConfigured(config);

    const localServersDir = path.join(app.getPath("userData"), "servers");
    const localServerPath = path.join(localServersDir, serverId);
    const r2ServerPath = `${RCLONE_CONFIG_NAME}:${config.bucket_name}/pass_the_host/${serverId}`;

    if (!fs.existsSync(localServerPath)) return false;

    onProgress?.(0, "0", "0");

    return new Promise<boolean>((resolve, reject) => {
      const rcloneProcess = spawn(
        RCLONE_PATH,
        ["sync", localServerPath, r2ServerPath, "--progress", "--stats", "1s", "--transfers", "8"],
        { shell: true }
      );

      let lastProgress = "";
      let outputBuffer = ""; // Buffer para acumular texto fragmentado

      rcloneProcess.stderr.on("data", (data: Buffer) => {
        outputBuffer += data.toString();

        // Dividir por saltos de línea y retornos de carro (rclone usa \r para actualizar línea)
        const lines = outputBuffer.split(/[\r\n]+/);

        // Guardar remanente
        outputBuffer = lines.pop() || "";

        for (const line of lines) {
          // Regex robusto igual que en download
          const match = line.match(/Transferred:\s*([^\/]+)\s*\/\s*([^,]+),\s*(\d+)%/);

          if (match) {
            const transferred = match[1].trim();
            const total = match[2].trim();
            const percent = parseInt(match[3]);

            const currentProgress = JSON.stringify({ transferred, percent });
            if (currentProgress !== lastProgress) {
              lastProgress = currentProgress;
              onProgress?.(percent, transferred, total);
            }
          }
        }
      });

      rcloneProcess.on("close", (code) => {
        if (code === 0) {
          onProgress?.(100, "Complete", "Complete");
          resolve(true);
        } else {
          reject(new Error(`Upload failed with code ${code}`));
        }
      });
      rcloneProcess.on("error", (error) => reject(error));
    });
  } catch (error) {
    console.error(`Error uploading server ${serverId} to R2:`, error);
    return false;
  }
}

/**
 * Reads the server port from server.properties file
 * @param serverId Server ID to read properties from
 * @returns The server port or 25565 as default
 */
export function readServerPort(serverId: string): number {
  const serverPath = getLocalServerPath(serverId);
  const propertiesPath = path.join(serverPath, "server.properties");

  try {
    if (!fs.existsSync(propertiesPath)) {
      return 25565;
    }

    const content = fs.readFileSync(propertiesPath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip comments and empty lines
      if (trimmedLine.startsWith("#") || trimmedLine === "") {
        continue;
      }

      // Look for server-port property
      if (trimmedLine.startsWith("server-port=")) {
        const portValue = trimmedLine.split("=")[1]?.trim();
        if (portValue) {
          const port = parseInt(portValue, 10);
          if (!isNaN(port) && port > 0 && port <= 65535) {
            return port;
          }
        }
      }
    }

    return 25565;
  } catch (error) {
    console.error(`Error reading server.properties for ${serverId}:`, error);
    return 25565;
  }
}

/**
 * Writes the server port to server.properties file
 * @param serverId Server ID to write properties to
 * @param port The port number to set
 * @returns true if successful, false otherwise
 */
export function writeServerPort(serverId: string, port: number): boolean {
  const serverPath = getLocalServerPath(serverId);
  const propertiesPath = path.join(serverPath, "server.properties");

  try {
    // Validate port
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(`Invalid port number: ${port}`);
      return false;
    }

    if (!fs.existsSync(propertiesPath)) {
      return false;
    }

    const content = fs.readFileSync(propertiesPath, "utf-8");
    const lines = content.split("\n");
    let portFound = false;

    // Update existing server-port line or add it
    const updatedLines = lines.map((line) => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("server-port=")) {
        portFound = true;
        return `server-port=${port}`;
      }

      return line;
    });

    // If server-port wasn't found, add it
    if (!portFound) {
      updatedLines.push(`server-port=${port}`);
    }

    fs.writeFileSync(propertiesPath, updatedLines.join("\n"), "utf-8");
    return true;
  } catch (error) {
    console.error(`Error writing server.properties for ${serverId}:`, error);
    return false;
  }
}
