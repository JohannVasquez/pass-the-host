import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { execSync, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let isInstalling = false;

const RCLONE_VERSION = "v1.65.0";
const RCLONE_DIR = path.join(app.getPath("userData"), "rclone");
const RCLONE_EXECUTABLE = process.platform === "win32" ? "rclone.exe" : "rclone";
const RCLONE_PATH = path.join(RCLONE_DIR, RCLONE_EXECUTABLE);

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

export async function installRclone(): Promise<boolean> {
  // Prevent concurrent installations
  if (isInstalling) {
    console.log("Rclone installation already in progress...");
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
    // Create rclone directory if it doesn't exist
    if (!fs.existsSync(RCLONE_DIR)) {
      fs.mkdirSync(RCLONE_DIR, { recursive: true });
    }

    const downloadUrl = getRcloneDownloadUrl();
    const zipPath = path.join(RCLONE_DIR, "rclone.zip");

    console.log("Downloading rclone from:", downloadUrl);

    // Download rclone
    await downloadFile(downloadUrl, zipPath);

    console.log("Extracting rclone...");

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
      fs.copyFileSync(extractedExecutable, RCLONE_PATH);

      // Make executable on Unix-based systems
      if (process.platform !== "win32") {
        fs.chmodSync(RCLONE_PATH, 0o755);
      }

      // Clean up
      fs.unlinkSync(zipPath);
      fs.rmSync(extractedDir, { recursive: true, force: true });

      console.log("Rclone installed successfully at:", RCLONE_PATH);
      return true;
    } else {
      throw new Error("Rclone executable not found in extracted files");
    }
  } catch (error) {
    console.error("Error installing rclone:", error);
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
    const configName = "pass-the-host-r2";
    // Use the endpoint directly from config
    const endpoint = config.endpoint;

    // Configure rclone for R2
    const configCommand = `"${RCLONE_PATH}" config create ${configName} s3 provider=Cloudflare access_key_id=${config.access_key} secret_access_key=${config.secret_key} endpoint=${endpoint} acl=private`;

    await execAsync(configCommand);

    // Test connection by listing the bucket
    const testCommand = `"${RCLONE_PATH}" lsd ${configName}:${config.bucket_name}`;
    await execAsync(testCommand);

    console.log("R2 connection test successful");
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
    const configName = "pass-the-host-r2";
    const endpoint = config.endpoint;

    // Ensure rclone is configured
    const configCommand = `"${RCLONE_PATH}" config create ${configName} s3 provider=Cloudflare access_key_id=${config.access_key} secret_access_key=${config.secret_key} endpoint=${endpoint} acl=private --non-interactive`;

    try {
      await execAsync(configCommand);
    } catch (error) {
      // Config might already exist, continue
    }

    // List directories in pass_the_host folder
    const listCommand = `"${RCLONE_PATH}" lsf ${configName}:${config.bucket_name}/pass_the_host --dirs-only`;
    const { stdout } = await execAsync(listCommand);

    const serverDirs = stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.replace(/\/$/, "")); // Remove trailing slash

    // For each server directory, try to detect version and type
    const servers = await Promise.all(
      serverDirs.map(async (serverName) => {
        const serverPath = `${configName}:${config.bucket_name}/pass_the_host/${serverName}`;

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
    console.debug(serverPath, listCommand);
    const { stdout } = await execAsync(listCommand);

    const files = stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "");

    // Check for Forge by looking in libraries/net/minecraftforge/forge/ directory
    console.debug(serverName, files);
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
  serverId: string
): Promise<boolean> {
  try {
    const configName = "pass-the-host-r2";
    const endpoint = config.endpoint;

    // Ensure rclone is configured
    const configCommand = `"${RCLONE_PATH}" config create ${configName} s3 provider=Cloudflare access_key_id=${config.access_key} secret_access_key=${config.secret_key} endpoint=${endpoint} acl=private --non-interactive`;

    try {
      await execAsync(configCommand);
    } catch (error) {
      // Config might already exist, continue
    }

    // Define paths
    const localServersDir = path.join(app.getPath("userData"), "servers");
    const localServerPath = path.join(localServersDir, serverId);
    const r2ServerPath = `${configName}:${config.bucket_name}/pass_the_host/${serverId}`;

    // Create servers directory if it doesn't exist
    if (!fs.existsSync(localServersDir)) {
      fs.mkdirSync(localServersDir, { recursive: true });
    }

    // Delete existing server directory to avoid outdated files
    if (fs.existsSync(localServerPath)) {
      console.log(`Deleting existing server files at: ${localServerPath}`);
      fs.rmSync(localServerPath, { recursive: true, force: true });
    }

    // Create fresh server directory
    fs.mkdirSync(localServerPath, { recursive: true });

    console.log(`Downloading server ${serverId} from R2...`);
    console.log(`Source: ${r2ServerPath}`);
    console.log(`Destination: ${localServerPath}`);

    // Sync from R2 to local directory
    const syncCommand = `"${RCLONE_PATH}" sync ${r2ServerPath} "${localServerPath}" --progress --transfers 8`;

    await execAsync(syncCommand, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer

    console.log(`Server ${serverId} downloaded successfully`);
    return true;
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
