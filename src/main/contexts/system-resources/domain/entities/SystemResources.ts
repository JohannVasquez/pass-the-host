export interface JavaVersion {
  version: string;
  path: string;
}

export interface JavaRequirement {
  minVersion: number;
  maxVersion?: number;
}

export interface JavaInstallationResult {
  success: boolean;
  javaPath?: string;
  version?: string;
  error?: string;
}

export interface SystemMemoryInfo {
  totalGB: number;
}

export interface NetworkInterface {
  name: string;
  ip: string;
}
