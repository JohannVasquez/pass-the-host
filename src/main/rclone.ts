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
