import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { IServerPropertiesRepository } from "../../domain/repositories";
import { FileSystemError, ValidationError } from "@shared/domain/errors";

@injectable()
export class ServerPropertiesRepository implements IServerPropertiesRepository {
  readPort(serverId: string): number {
    const serverPath = this.getLocalServerPath(serverId);
    const propertiesPath = path.join(serverPath, "server.properties");

    try {
      if (!fs.existsSync(propertiesPath)) {
        return 25565;
      }

      const content = fs.readFileSync(propertiesPath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("#") || trimmedLine === "") {
          continue;
        }

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
    } catch {
      // Expected case: file missing or unreadable, return default port
      return 25565;
    }
  }

  writePort(serverId: string, port: number): boolean {
    const serverPath = this.getLocalServerPath(serverId);
    const propertiesPath = path.join(serverPath, "server.properties");

    if (isNaN(port) || port < 1 || port > 65535) {
      throw new ValidationError(`Invalid port number: ${port}. Port must be between 1 and 65535.`);
    }

    if (!fs.existsSync(propertiesPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(propertiesPath, "utf-8");
      const lines = content.split("\n");
      let portFound = false;

      const updatedLines = lines.map((line) => {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("server-port=")) {
          portFound = true;
          return `server-port=${port}`;
        }

        return line;
      });

      if (!portFound) {
        updatedLines.push(`server-port=${port}`);
      }

      fs.writeFileSync(propertiesPath, updatedLines.join("\n"), "utf-8");
      return true;
    } catch (error) {
      throw new FileSystemError(
        `Failed to write server.properties for ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getLocalServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }
}
