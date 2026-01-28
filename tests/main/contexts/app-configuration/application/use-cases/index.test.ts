import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LoadConfigUseCase,
  SaveR2ConfigUseCase,
  SaveUsernameUseCase,
  SaveRamConfigUseCase,
  SaveLanguageUseCase,
} from "../../../../../../src/main/contexts/app-configuration/application/use-cases";
import type { IAppConfigurationRepository } from "../../../../../../src/main/contexts/app-configuration/domain/repositories";
import type {
  AppConfig,
  R2Config,
  ConfigSaveResult,
} from "../../../../../../src/main/contexts/app-configuration/domain/entities";

describe("App Configuration Use Cases", () => {
  // Mock repository
  const mockRepository: IAppConfigurationRepository = {
    loadConfig: vi.fn(),
    saveR2Config: vi.fn(),
    saveUsername: vi.fn(),
    saveRamConfig: vi.fn(),
    saveLanguage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LoadConfigUseCase", () => {
    it("should return config from repository", async () => {
      const mockConfig: AppConfig = {
        r2: { endpoint: "https://r2.example.com" },
        server: { memory_min: "2G", memory_max: "4G" },
        app: { owner_name: "TestUser", language: "en" },
      };

      vi.mocked(mockRepository.loadConfig).mockResolvedValue(mockConfig);

      const useCase = new LoadConfigUseCase(mockRepository);
      const result = await useCase.execute();

      expect(result).toEqual(mockConfig);
      expect(mockRepository.loadConfig).toHaveBeenCalledTimes(1);
    });

    it("should return null when repository returns null", async () => {
      vi.mocked(mockRepository.loadConfig).mockResolvedValue(null);

      const useCase = new LoadConfigUseCase(mockRepository);
      const result = await useCase.execute();

      expect(result).toBeNull();
    });
  });

  describe("SaveR2ConfigUseCase", () => {
    it("should save R2 config via repository", async () => {
      const r2Config: R2Config = {
        endpoint: "https://r2.example.com",
        access_key: "key123",
        secret_key: "secret456",
        bucket_name: "my-bucket",
      };

      const expectedResult: ConfigSaveResult = { success: true };
      vi.mocked(mockRepository.saveR2Config).mockResolvedValue(expectedResult);

      const useCase = new SaveR2ConfigUseCase(mockRepository);
      const result = await useCase.execute(r2Config);

      expect(result).toEqual(expectedResult);
      expect(mockRepository.saveR2Config).toHaveBeenCalledWith(r2Config);
    });

    it("should return error result when save fails", async () => {
      const r2Config: R2Config = { endpoint: "test" };
      const expectedResult: ConfigSaveResult = {
        success: false,
        error: "Failed to save",
      };

      vi.mocked(mockRepository.saveR2Config).mockResolvedValue(expectedResult);

      const useCase = new SaveR2ConfigUseCase(mockRepository);
      const result = await useCase.execute(r2Config);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to save");
    });
  });

  describe("SaveUsernameUseCase", () => {
    it("should save username via repository", async () => {
      const expectedResult: ConfigSaveResult = { success: true };
      vi.mocked(mockRepository.saveUsername).mockResolvedValue(expectedResult);

      const useCase = new SaveUsernameUseCase(mockRepository);
      const result = await useCase.execute("NewUsername");

      expect(result).toEqual(expectedResult);
      expect(mockRepository.saveUsername).toHaveBeenCalledWith("NewUsername");
    });

    it("should handle empty username", async () => {
      const expectedResult: ConfigSaveResult = { success: true };
      vi.mocked(mockRepository.saveUsername).mockResolvedValue(expectedResult);

      const useCase = new SaveUsernameUseCase(mockRepository);
      const result = await useCase.execute("");

      expect(result.success).toBe(true);
      expect(mockRepository.saveUsername).toHaveBeenCalledWith("");
    });
  });

  describe("SaveRamConfigUseCase", () => {
    it("should save RAM config via repository", async () => {
      const expectedResult: ConfigSaveResult = { success: true };
      vi.mocked(mockRepository.saveRamConfig).mockResolvedValue(expectedResult);

      const useCase = new SaveRamConfigUseCase(mockRepository);
      const result = await useCase.execute(4, 16);

      expect(result).toEqual(expectedResult);
      expect(mockRepository.saveRamConfig).toHaveBeenCalledWith(4, 16);
    });

    it("should pass min and max values correctly", async () => {
      const expectedResult: ConfigSaveResult = { success: true };
      vi.mocked(mockRepository.saveRamConfig).mockResolvedValue(expectedResult);

      const useCase = new SaveRamConfigUseCase(mockRepository);
      await useCase.execute(2, 8);

      expect(mockRepository.saveRamConfig).toHaveBeenCalledWith(2, 8);
    });
  });

  describe("SaveLanguageUseCase", () => {
    it("should save language via repository", async () => {
      const expectedResult: ConfigSaveResult = { success: true };
      vi.mocked(mockRepository.saveLanguage).mockResolvedValue(expectedResult);

      const useCase = new SaveLanguageUseCase(mockRepository);
      const result = await useCase.execute("es");

      expect(result).toEqual(expectedResult);
      expect(mockRepository.saveLanguage).toHaveBeenCalledWith("es");
    });

    it("should handle different language codes", async () => {
      const expectedResult: ConfigSaveResult = { success: true };
      vi.mocked(mockRepository.saveLanguage).mockResolvedValue(expectedResult);

      const useCase = new SaveLanguageUseCase(mockRepository);

      await useCase.execute("en");
      expect(mockRepository.saveLanguage).toHaveBeenCalledWith("en");

      await useCase.execute("fr");
      expect(mockRepository.saveLanguage).toHaveBeenCalledWith("fr");

      await useCase.execute("de");
      expect(mockRepository.saveLanguage).toHaveBeenCalledWith("de");
    });
  });
});
