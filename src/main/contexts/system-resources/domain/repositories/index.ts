import {
  JavaVersion,
  JavaRequirement,
  JavaInstallationResult,
  SystemMemoryInfo,
  NetworkInterface,
} from "@main/contexts/system-resources/domain/entities";

export interface ISystemResourcesRepository {
  getInstalledJavaVersions(): JavaVersion[];
  getRequiredJavaVersion(minecraftVersion: string): JavaRequirement;
  ensureJavaForMinecraft(
    minecraftVersion: string,
    onProgress?: (message: string) => void,
  ): Promise<JavaInstallationResult>;
  getTotalMemory(): SystemMemoryInfo;
  getNetworkInterfaces(): NetworkInterface[];
}
