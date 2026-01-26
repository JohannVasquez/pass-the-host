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
  ServerRuntimeRepository: Symbol.for("ServerRuntimeRepository"),

  // Use Cases
  StartServerUseCase: Symbol.for("StartServerUseCase"),
  StopServerUseCase: Symbol.for("StopServerUseCase"),
  ExecuteCommandUseCase: Symbol.for("ExecuteCommandUseCase"),
  GetServerStatusUseCase: Symbol.for("GetServerStatusUseCase"),
};

// ============================================
// CLOUD STORAGE CONTEXT
// ============================================
export const CLOUD_STORAGE_TYPES = {
  // Repositories
  CloudStorageRepository: Symbol.for("CloudStorageRepository"),

  // Use Cases
  ConfigureR2UseCase: Symbol.for("ConfigureR2UseCase"),
  TestR2ConnectionUseCase: Symbol.for("TestR2ConnectionUseCase"),
  ListRemoteServersUseCase: Symbol.for("ListRemoteServersUseCase"),
  DownloadServerUseCase: Symbol.for("DownloadServerUseCase"),
  UploadServerUseCase: Symbol.for("UploadServerUseCase"),
  DeleteRemoteServerUseCase: Symbol.for("DeleteRemoteServerUseCase"),
};

// ============================================
// SERVER LOCKING CONTEXT
// ============================================
export const SERVER_LOCKING_TYPES = {
  // Repositories
  ServerLockRepository: Symbol.for("ServerLockRepository"),

  // Use Cases
  CreateServerLockUseCase: Symbol.for("CreateServerLockUseCase"),
  CheckServerLockUseCase: Symbol.for("CheckServerLockUseCase"),
  UploadServerLockUseCase: Symbol.for("UploadServerLockUseCase"),
  ReleaseServerLockUseCase: Symbol.for("ReleaseServerLockUseCase"),
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
  UploadSessionUseCase: Symbol.for("UploadSessionUseCase"),
  GetServerStatisticsUseCase: Symbol.for("GetServerStatisticsUseCase"),
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
};

// ============================================
// APP CONFIGURATION CONTEXT
// ============================================
export const APP_CONFIGURATION_TYPES = {
  // Repositories
  ConfigurationRepository: Symbol.for("ConfigurationRepository"),

  // Use Cases
  LoadConfigurationUseCase: Symbol.for("LoadConfigurationUseCase"),
  SaveUsernameUseCase: Symbol.for("SaveUsernameUseCase"),
  ChangeLanguageUseCase: Symbol.for("ChangeLanguageUseCase"),
  SaveRamConfigUseCase: Symbol.for("SaveRamConfigUseCase"),
};

// ============================================
// SHARED
// ============================================
export const SHARED_TYPES = {
  EventBus: Symbol.for("EventBus"),
};
