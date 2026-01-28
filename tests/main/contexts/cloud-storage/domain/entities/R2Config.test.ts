import { describe, it, expect } from "vitest";
import type {
  R2Config,
  ServerInfo,
  TransferProgress,
} from "../../../../../../src/main/contexts/cloud-storage/domain/entities/R2Config";

describe("R2Config", () => {
  describe("interface", () => {
    it("should create an R2 config with all required properties", () => {
      const config: R2Config = {
        endpoint: "https://xxxx.r2.cloudflarestorage.com",
        access_key: "access_key_123",
        secret_key: "secret_key_456",
        bucket_name: "my-bucket",
      };

      expect(config.endpoint).toBe("https://xxxx.r2.cloudflarestorage.com");
      expect(config.access_key).toBe("access_key_123");
      expect(config.secret_key).toBe("secret_key_456");
      expect(config.bucket_name).toBe("my-bucket");
    });

    it("should support different endpoint formats", () => {
      const config1: R2Config = {
        endpoint: "https://account-id.r2.cloudflarestorage.com",
        access_key: "key",
        secret_key: "secret",
        bucket_name: "bucket",
      };

      const config2: R2Config = {
        endpoint: "https://custom-endpoint.example.com",
        access_key: "key",
        secret_key: "secret",
        bucket_name: "bucket",
      };

      expect(config1.endpoint).toContain("r2.cloudflarestorage.com");
      expect(config2.endpoint).toContain("example.com");
    });
  });
});

describe("ServerInfo", () => {
  describe("interface", () => {
    it("should create server info with all properties", () => {
      const serverInfo: ServerInfo = {
        id: "server-123",
        name: "My Minecraft Server",
        version: "1.20.4",
        type: "vanilla",
      };

      expect(serverInfo.id).toBe("server-123");
      expect(serverInfo.name).toBe("My Minecraft Server");
      expect(serverInfo.version).toBe("1.20.4");
      expect(serverInfo.type).toBe("vanilla");
    });

    it("should support forge server type", () => {
      const serverInfo: ServerInfo = {
        id: "modded-server",
        name: "Forge Server",
        version: "1.20.1",
        type: "forge",
      };

      expect(serverInfo.type).toBe("forge");
    });

    it("should support various version formats", () => {
      const servers: ServerInfo[] = [
        { id: "1", name: "Server 1", version: "1.20", type: "vanilla" },
        { id: "2", name: "Server 2", version: "1.20.4", type: "vanilla" },
        { id: "3", name: "Server 3", version: "1.7.10", type: "forge" },
      ];

      expect(servers[0].version).toBe("1.20");
      expect(servers[1].version).toBe("1.20.4");
      expect(servers[2].version).toBe("1.7.10");
    });
  });
});

describe("TransferProgress", () => {
  describe("interface", () => {
    it("should create transfer progress with all properties", () => {
      const progress: TransferProgress = {
        percent: 45,
        transferred: "128 MB",
        total: "256 MB",
      };

      expect(progress.percent).toBe(45);
      expect(progress.transferred).toBe("128 MB");
      expect(progress.total).toBe("256 MB");
    });

    it("should handle 0% progress", () => {
      const progress: TransferProgress = {
        percent: 0,
        transferred: "0 B",
        total: "1 GB",
      };

      expect(progress.percent).toBe(0);
      expect(progress.transferred).toBe("0 B");
    });

    it("should handle 100% progress", () => {
      const progress: TransferProgress = {
        percent: 100,
        transferred: "512 MB",
        total: "512 MB",
      };

      expect(progress.percent).toBe(100);
      expect(progress.transferred).toBe(progress.total);
    });

    it("should support various size formats", () => {
      const progressB: TransferProgress = { percent: 50, transferred: "500 B", total: "1 KB" };
      const progressKB: TransferProgress = { percent: 50, transferred: "500 KB", total: "1 MB" };
      const progressMB: TransferProgress = { percent: 50, transferred: "500 MB", total: "1 GB" };
      const progressGB: TransferProgress = { percent: 50, transferred: "1 GB", total: "2 GB" };

      expect(progressB.total).toContain("KB");
      expect(progressKB.total).toContain("MB");
      expect(progressMB.total).toContain("GB");
      expect(progressGB.total).toContain("GB");
    });
  });
});
