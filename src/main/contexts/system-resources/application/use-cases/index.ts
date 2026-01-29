import { ISystemResourcesRepository } from "../../domain/repositories";
import {
  JavaInstallationResult,
  JavaVersion,
  JavaRequirement,
  SystemMemoryInfo,
  NetworkInterface,
} from "../../domain/entities";

export class EnsureJavaForMinecraftUseCase {
  constructor(private repository: ISystemResourcesRepository) {}

  async execute(
    minecraftVersion: string,
    onProgress?: (message: string) => void,
  ): Promise<JavaInstallationResult> {
    return this.repository.ensureJavaForMinecraft(minecraftVersion, onProgress);
  }
}

export class GetInstalledJavaVersionsUseCase {
  constructor(private repository: ISystemResourcesRepository) {}

  execute(): JavaVersion[] {
    return this.repository.getInstalledJavaVersions();
  }
}

export class GetRequiredJavaVersionUseCase {
  constructor(private repository: ISystemResourcesRepository) {}

  execute(minecraftVersion: string): JavaRequirement {
    return this.repository.getRequiredJavaVersion(minecraftVersion);
  }
}

export class GetTotalMemoryUseCase {
  constructor(private repository: ISystemResourcesRepository) {}

  execute(): SystemMemoryInfo {
    return this.repository.getTotalMemory();
  }
}

export class GetNetworkInterfacesUseCase {
  constructor(private repository: ISystemResourcesRepository) {}

  execute(): NetworkInterface[] {
    return this.repository.getNetworkInterfaces();
  }
}
