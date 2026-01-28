import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock electron app module
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}));

// Import after mocking
import {
  loadConfig,
  saveR2Config,
  saveUsername,
  saveRamConfig,
  saveLanguage,
  getLanguage,
  getConfigPath,
} from "../../src/main/config";

// Mock fs module
vi.mock("fs");

describe("config", () => {
  const mockConfigPath = path.join("/mock/userData", "config.json");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getConfigPath", () => {
    it("should return path in userData directory", () => {
      const configPath = getConfigPath();

      expect(configPath).toBe(mockConfigPath);
    });
  });

  describe("loadConfig", () => {
    it("should return config when file exists", () => {
      const mockConfig = {
        r2: { endpoint: "https://r2.example.com", bucket_name: "test" },
        server: { memory_min: "4G", memory_max: "8G" },
        app: { owner_name: "TestUser", language: "es" },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const result = loadConfig();

      expect(result).toEqual(mockConfig);
      expect(fs.existsSync).toHaveBeenCalledWith(mockConfigPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockConfigPath, "utf-8");
    });

    it("should return default config when file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = loadConfig();

      expect(result).toEqual({
        r2: {
          endpoint: "",
          access_key: "",
          secret_key: "",
          bucket_name: "",
          region: "auto",
        },
        server: {
          server_path: "./server_files",
          java_path: "./java_runtime/bin/java.exe",
          server_jar: "server.jar",
          server_type: "vanilla",
          memory_min: "2G",
          memory_max: "4G",
          server_port: 25565,
        },
        app: {
          owner_name: null,
          language: "en",
        },
      });
    });

    it("should return null when reading file throws error", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Read error");
      });

      const result = loadConfig();

      expect(result).toBeNull();
    });
  });

  describe("saveR2Config", () => {
    it("should save R2 config to existing file", () => {
      const existingConfig = {
        r2: { endpoint: "old" },
        server: { memory_min: "2G" },
        app: { owner_name: "User" },
      };
      const newR2Config = {
        endpoint: "https://new.endpoint.com",
        bucket_name: "new-bucket",
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = saveR2Config(newR2Config);

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      const writtenConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenConfig.r2.endpoint).toBe("https://new.endpoint.com");
      expect(writtenConfig.r2.bucket_name).toBe("new-bucket");
    });

    it("should create default config when file does not exist", () => {
      const newR2Config = { endpoint: "https://r2.example.com" };

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = saveR2Config(newR2Config);

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      const writtenConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenConfig.r2.endpoint).toBe("https://r2.example.com");
      expect(writtenConfig.server).toBeDefined();
      expect(writtenConfig.app).toBeDefined();
    });

    it("should return false when write fails", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Write error");
      });

      const result = saveR2Config({ endpoint: "test" });

      expect(result).toBe(false);
    });
  });

  describe("saveUsername", () => {
    it("should save username to existing config", () => {
      const existingConfig = {
        r2: {},
        server: {},
        app: { owner_name: "OldUser", language: "en" },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = saveUsername("NewUser");

      expect(result).toBe(true);

      const writtenConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenConfig.app.owner_name).toBe("NewUser");
    });

    it("should create app section if not exists", () => {
      const existingConfig = { r2: {}, server: {} };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = saveUsername("TestUser");

      expect(result).toBe(true);

      const writtenConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenConfig.app.owner_name).toBe("TestUser");
    });

    it("should return false when write fails", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Write error");
      });

      const result = saveUsername("User");

      expect(result).toBe(false);
    });
  });

  describe("saveRamConfig", () => {
    it("should save RAM config to existing file", () => {
      const existingConfig = {
        r2: {},
        server: { memory_min: "2G", memory_max: "4G" },
        app: {},
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = saveRamConfig(4, 16);

      expect(result).toBe(true);

      const writtenConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenConfig.server.memory_min).toBe("4G");
      expect(writtenConfig.server.memory_max).toBe("16G");
    });

    it("should create server section if not exists", () => {
      const existingConfig = { r2: {}, app: {} };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = saveRamConfig(2, 8);

      expect(result).toBe(true);

      const writtenConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenConfig.server.memory_min).toBe("2G");
      expect(writtenConfig.server.memory_max).toBe("8G");
    });

    it("should return false when write fails", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Write error");
      });

      const result = saveRamConfig(2, 4);

      expect(result).toBe(false);
    });
  });

  describe("saveLanguage", () => {
    it("should save language to existing config", () => {
      const existingConfig = {
        r2: {},
        server: {},
        app: { language: "en" },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = saveLanguage("es");

      expect(result).toBe(true);

      const writtenConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenConfig.app.language).toBe("es");
    });

    it("should create app section if not exists", () => {
      const existingConfig = { r2: {}, server: {} };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = saveLanguage("fr");

      expect(result).toBe(true);

      const writtenConfig = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenConfig.app.language).toBe("fr");
    });

    it("should return false when write fails", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Write error");
      });

      const result = saveLanguage("en");

      expect(result).toBe(false);
    });
  });

  describe("getLanguage", () => {
    it("should return language from config", () => {
      const mockConfig = { app: { language: "es" } };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const result = getLanguage();

      expect(result).toBe("es");
    });

    it("should return default language when config does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = getLanguage();

      expect(result).toBe("en");
    });

    it("should return default language when app section is missing", () => {
      const mockConfig = { r2: {}, server: {} };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const result = getLanguage();

      expect(result).toBe("en");
    });

    it("should return default language when read fails", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Read error");
      });

      const result = getLanguage();

      expect(result).toBe("en");
    });
  });
});
