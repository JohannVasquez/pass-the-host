import {
  JavaVersion,
  JavaRequirement,
  JavaInstallationResult,
  SystemMemoryInfo,
  NetworkInterface,
} from "../entities";

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
