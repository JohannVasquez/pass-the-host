/**
 * Symbols for dependency injection with Inversify
 * Organized by bounded contexts
 */

// ============================================
// SERVER LIFECYCLE CONTEXT
// ============================================
export const SERVER_LIFECYCLE_TYPES = {
  // Repositories
  ServerRepository: Symbol.for("ServerRepository"),

  // Use Cases
  CreateServerUseCase: Symbol.for("CreateServerUseCase"),
  DeleteServerUseCase: Symbol.for("DeleteServerUseCase"),
  ListServersUseCase: Symbol.for("ListServersUseCase"),
  GetServerDetailsUseCase: Symbol.for("GetServerDetailsUseCase"),
};

// ============================================
// SERVER RUNTIME CONTEXT
// ============================================
export const SERVER_RUNTIME_TYPES = {
  // Repositories
  ServerProcessRepository: Symbol.for("ServerProcessRepository"),

  // Use Cases
  StartServerUseCase: Symbol.for("StartServerUseCase"),
  StopServerUseCase: Symbol.for("StopServerUseCase"),
  ExecuteCommandUseCase: Symbol.for("ExecuteCommandUseCase"),
  MonitorServerStatusUseCase: Symbol.for("MonitorServerStatusUseCase"),
  GetServerLogsUseCase: Symbol.for("GetServerLogsUseCase"),
};

// ============================================
// CLOUD STORAGE CONTEXT
// ============================================
export const CLOUD_STORAGE_TYPES = {
  // Services
  R2Service: Symbol.for("R2Service"),

  // Repositories
  R2ServerRepository: Symbol.for("R2ServerRepository"),

  // Use Cases
  ConfigureR2UseCase: Symbol.for("ConfigureR2UseCase"),
  TestR2ConnectionUseCase: Symbol.for("TestR2ConnectionUseCase"),
  DownloadServerUseCase: Symbol.for("DownloadServerUseCase"),
  UploadServerUseCase: Symbol.for("UploadServerUseCase"),
  DeleteServerFromR2UseCase: Symbol.for("DeleteServerFromR2UseCase"),
  ListR2ServersUseCase: Symbol.for("ListR2ServersUseCase"),
};

// ============================================
// SERVER LOCKING CONTEXT
// ============================================
export const SERVER_LOCKING_TYPES = {
  // Repositories
  ServerLockRepository: Symbol.for("ServerLockRepository"),

  // Use Cases
  CreateServerLockUseCase: Symbol.for("CreateServerLockUseCase"),
  ReleaseServerLockUseCase: Symbol.for("ReleaseServerLockUseCase"),
  CheckServerLockUseCase: Symbol.for("CheckServerLockUseCase"),
  GetServerLockStatusUseCase: Symbol.for("GetServerLockStatusUseCase"),
};

// ============================================
// SESSION TRACKING CONTEXT
// ============================================
export const SESSION_TRACKING_TYPES = {
  // Repositories
  SessionRepository: Symbol.for("SessionRepository"),

  // Use Cases
  CreateSessionUseCase: Symbol.for("CreateSessionUseCase"),
  EndSessionUseCase: Symbol.for("EndSessionUseCase"),
  GetServerStatisticsUseCase: Symbol.for("GetServerStatisticsUseCase"),
  GetSessionHistoryUseCase: Symbol.for("GetSessionHistoryUseCase"),
};

// ============================================
// SYSTEM RESOURCES CONTEXT
// ============================================
export const SYSTEM_RESOURCES_TYPES = {
  // Repositories
  SystemResourcesRepository: Symbol.for("SystemResourcesRepository"),

  // Use Cases
  GetSystemMemoryUseCase: Symbol.for("GetSystemMemoryUseCase"),
  GetNetworkInterfacesUseCase: Symbol.for("GetNetworkInterfacesUseCase"),
  ConfigureRamUseCase: Symbol.for("ConfigureRamUseCase"),
  ConfigureNetworkUseCase: Symbol.for("ConfigureNetworkUseCase"),
  GetJavaVersionsUseCase: Symbol.for("GetJavaVersionsUseCase"),
  DownloadJavaUseCase: Symbol.for("DownloadJavaUseCase"),
};

// ============================================
// APP CONFIGURATION CONTEXT
// ============================================
export const APP_CONFIGURATION_TYPES = {
  // Repositories
  ConfigRepository: Symbol.for("ConfigRepository"),

  // Use Cases
  LoadConfigurationUseCase: Symbol.for("LoadConfigurationUseCase"),
  SaveConfigurationUseCase: Symbol.for("SaveConfigurationUseCase"),
  ChangeLanguageUseCase: Symbol.for("ChangeLanguageUseCase"),
  SaveUsernameUseCase: Symbol.for("SaveUsernameUseCase"),
};

// ============================================
// SHARED
// ============================================
export const SHARED_TYPES = {
  EventBus: Symbol.for("EventBus"),
};
