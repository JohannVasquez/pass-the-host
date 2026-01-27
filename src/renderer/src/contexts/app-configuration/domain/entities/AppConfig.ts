/**
 * Application Configuration entity
 * Represents the general application configuration
 */
export interface AppConfig {
  username: string;
  language: string;
  ramConfig: {
    min: number;
    max: number;
  };
}

/**
 * Partial application configuration for updates
 */
export type PartialAppConfig = Partial<AppConfig>;
