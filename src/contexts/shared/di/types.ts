/**
 * Symbols for dependency injection with Inversify
 * Organized by bounded contexts
 */
export const SERVER_LIFECYCLE_TYPES = {
  ServerRepository: Symbol.for("ServerRepository"),
  CreateServerUseCase: Symbol.for("CreateServerUseCase"),
  DeleteServerUseCase: Symbol.for("DeleteServerUseCase"),
  ListServersUseCase: Symbol.for("ListServersUseCase"),
  GetServerDetailsUseCase: Symbol.for("GetServerDetailsUseCase"),
};

export const SERVER_RUNTIME_TYPES = {
  ServerRuntimeRepository: Symbol.for("ServerRuntimeRepository"),
  StartServerUseCase: Symbol.for("StartServerUseCase"),
  StopServerUseCase: Symbol.for("StopServerUseCase"),
  ExecuteCommandUseCase: Symbol.for("ExecuteCommandUseCase"),
  GetServerStatusUseCase: Symbol.for("GetServerStatusUseCase"),
};

export const CLOUD_STORAGE_TYPES = {
  CloudStorageRepository: Symbol.for("CloudStorageRepository"),
  ConfigureR2UseCase: Symbol.for("ConfigureR2UseCase"),
  TestR2ConnectionUseCase: Symbol.for("TestR2ConnectionUseCase"),
  ListRemoteServersUseCase: Symbol.for("ListRemoteServersUseCase"),
  DownloadServerUseCase: Symbol.for("DownloadServerUseCase"),
  UploadServerUseCase: Symbol.for("UploadServerUseCase"),
  DeleteRemoteServerUseCase: Symbol.for("DeleteRemoteServerUseCase"),
};

export const SERVER_LOCKING_TYPES = {
  ServerLockRepository: Symbol.for("ServerLockRepository"),
  CreateServerLockUseCase: Symbol.for("CreateServerLockUseCase"),
  CheckServerLockUseCase: Symbol.for("CheckServerLockUseCase"),
  UploadServerLockUseCase: Symbol.for("UploadServerLockUseCase"),
  ReleaseServerLockUseCase: Symbol.for("ReleaseServerLockUseCase"),
  MonitorServerLockUseCase: Symbol.for("MonitorServerLockUseCase"),
};

export const SESSION_TRACKING_TYPES = {
  SessionRepository: Symbol.for("SessionRepository"),
  CreateSessionUseCase: Symbol.for("CreateSessionUseCase"),
  EndSessionUseCase: Symbol.for("EndSessionUseCase"),
  UploadSessionUseCase: Symbol.for("UploadSessionUseCase"),
  GetServerStatisticsUseCase: Symbol.for("GetServerStatisticsUseCase"),
};

export const SYSTEM_RESOURCES_TYPES = {
  SystemResourcesRepository: Symbol.for("SystemResourcesRepository"),
  GetSystemMemoryUseCase: Symbol.for("GetSystemMemoryUseCase"),
  GetNetworkInterfacesUseCase: Symbol.for("GetNetworkInterfacesUseCase"),
};

export const APP_CONFIGURATION_TYPES = {
  ConfigurationRepository: Symbol.for("ConfigurationRepository"),
  LoadConfigurationUseCase: Symbol.for("LoadConfigurationUseCase"),
  SaveUsernameUseCase: Symbol.for("SaveUsernameUseCase"),
  ChangeLanguageUseCase: Symbol.for("ChangeLanguageUseCase"),
  SaveRamConfigUseCase: Symbol.for("SaveRamConfigUseCase"),
};

export const SHARED_TYPES = {
  EventBus: Symbol.for("EventBus"),
};
