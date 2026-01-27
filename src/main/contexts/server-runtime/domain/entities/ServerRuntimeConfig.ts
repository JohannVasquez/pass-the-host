export interface ServerRuntimeConfig {
  workingDir: string;
  command: string;
  args: string[];
  autoAcceptEula?: boolean;
}

export interface ForgeJvmArgs {
  allArgs: string[];
  minRam?: string;
  maxRam?: string;
}
