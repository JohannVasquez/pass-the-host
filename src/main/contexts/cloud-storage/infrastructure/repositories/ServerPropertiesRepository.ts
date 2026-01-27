import { injectable } from "inversify";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { IServerPropertiesRepository } from "../../domain/repositories";

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
    } catch (error) {
      console.error(`Error reading server.properties for ${serverId}:`, error);
      return 25565;
    }
  }

  writePort(serverId: string, port: number): boolean {
    const serverPath = this.getLocalServerPath(serverId);
    const propertiesPath = path.join(serverPath, "server.properties");

    try {
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
      console.error(`Error writing server.properties for ${serverId}:`, error);
      return false;
    }
  }

  private getLocalServerPath(serverId: string): string {
    return path.join(app.getPath("userData"), "servers", serverId);
  }
}
