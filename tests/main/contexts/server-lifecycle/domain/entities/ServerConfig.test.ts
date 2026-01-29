import { describe, it, expect } from "vitest";
import type {
  MinecraftServerConfig,
  ServerCreationResult,
  ServerDeletionResult,
} from "../../../../../../src/main/contexts/server-lifecycle/domain/entities";

describe("ServerConfig", () => {
  describe("MinecraftServerConfig", () => {
    it("should create a vanilla server config", () => {
      const config: MinecraftServerConfig = {
        serverName: "My Vanilla Server",
        version: "1.20.4",
        serverType: "vanilla",
      };

      expect(config.serverName).toBe("My Vanilla Server");
      expect(config.version).toBe("1.20.4");
      expect(config.serverType).toBe("vanilla");
    });

    it("should create a forge server config", () => {
      const config: MinecraftServerConfig = {
        serverName: "My Modded Server",
        version: "1.20.1",
        serverType: "forge",
      };

      expect(config.serverName).toBe("My Modded Server");
      expect(config.version).toBe("1.20.1");
      expect(config.serverType).toBe("forge");
    });

    it("should support various version formats", () => {
      const config1: MinecraftServerConfig = {
        serverName: "Server",
        version: "1.20",
        serverType: "vanilla",
      };

      const config2: MinecraftServerConfig = {
        serverName: "Server",
        version: "1.19.4",
        serverType: "vanilla",
      };

      const config3: MinecraftServerConfig = {
        serverName: "Server",
        version: "1.7.10",
        serverType: "forge",
      };

      expect(config1.version).toBe("1.20");
      expect(config2.version).toBe("1.19.4");
      expect(config3.version).toBe("1.7.10");
    });
  });

  describe("ServerCreationResult", () => {
    it("should indicate successful creation", () => {
      const result: ServerCreationResult = {
        success: true,
      };

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should indicate failed creation with error message", () => {
      const result: ServerCreationResult = {
        success: false,
        error: "Failed to download server JAR",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to download server JAR");
    });

    it("should support various error messages", () => {
      const errors: ServerCreationResult[] = [
        { success: false, error: "Network error" },
        { success: false, error: "Insufficient disk space" },
        { success: false, error: "Invalid version" },
      ];

      expect(errors[0].error).toBe("Network error");
      expect(errors[1].error).toBe("Insufficient disk space");
      expect(errors[2].error).toBe("Invalid version");
    });
  });

  describe("ServerDeletionResult", () => {
    it("should indicate successful deletion", () => {
      const result: ServerDeletionResult = {
        success: true,
      };

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should indicate failed deletion with error message", () => {
      const result: ServerDeletionResult = {
        success: false,
        error: "Server folder not found",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Server folder not found");
    });

    it("should support permission error", () => {
      const result: ServerDeletionResult = {
        success: false,
        error: "Permission denied",
      };

      expect(result.error).toBe("Permission denied");
    });
  });
});
