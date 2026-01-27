/**
 * RAM Configuration entity
 * Represents memory allocation for servers
 */
export interface RamConfig {
  min: number; // Minimum RAM in GB
  max: number; // Maximum RAM in GB
}

/**
 * System Memory Information
 */
export interface SystemMemory {
  totalGB: number;
  availableGB?: number;
  usedGB?: number;
}
