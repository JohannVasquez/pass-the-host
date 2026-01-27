import { BaseDomainEvent } from "./DomainEvent";

// ============================================
// SERVER LIFECYCLE EVENTS
// ============================================

export class ServerCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly serverName: string,
    public readonly serverType: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.created";
  }
}

export class ServerDeletedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly serverName: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.deleted";
  }
}

export class ServerSelectedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly serverName: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.selected";
  }
}

// ============================================
// SERVER RUNTIME EVENTS
// ============================================

export class ServerStartingEvent extends BaseDomainEvent {
  constructor(public readonly serverId: string) {
    super(serverId);
  }

  get eventName(): string {
    return "server.starting";
  }
}

export class ServerStartedEvent extends BaseDomainEvent {
  constructor(public readonly serverId: string) {
    super(serverId);
  }

  get eventName(): string {
    return "server.started";
  }
}

export class ServerStoppingEvent extends BaseDomainEvent {
  constructor(public readonly serverId: string) {
    super(serverId);
  }

  get eventName(): string {
    return "server.stopping";
  }
}

export class ServerStoppedEvent extends BaseDomainEvent {
  constructor(public readonly serverId: string) {
    super(serverId);
  }

  get eventName(): string {
    return "server.stopped";
  }
}

export class ServerCommandExecutedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly command: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.command.executed";
  }
}

export class ServerLogReceivedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly message: string,
    public readonly type: "info" | "warning" | "error" | "success"
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.log.received";
  }
}

// ============================================
// CLOUD STORAGE EVENTS
// ============================================

export class R2ConfiguredEvent extends BaseDomainEvent {
  constructor(data: { endpoint: string; bucket: string; region: string }) {
    super();
    this.endpoint = data.endpoint;
    this.bucket = data.bucket;
    this.region = data.region;
  }

  public readonly endpoint: string;
  public readonly bucket: string;
  public readonly region: string;

  get eventName(): string {
    return "r2.configured";
  }
}

export class R2ConnectionTestedEvent extends BaseDomainEvent {
  constructor(data: { success: boolean; endpoint: string }) {
    super();
    this.success = data.success;
    this.endpoint = data.endpoint;
  }

  public readonly success: boolean;
  public readonly endpoint: string;

  get eventName(): string {
    return "r2.connection.tested";
  }
}

export class ServerDownloadStartedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; serverName?: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.serverName = data.serverName || data.serverId;
  }

  public readonly serverId: string;
  public readonly serverName: string;

  get eventName(): string {
    return "server.download.started";
  }
}

export class ServerDownloadProgressEvent extends BaseDomainEvent {
  constructor(data: {
    serverId: string;
    progress: number;
    bytesTransferred: number;
    totalBytes: number;
  }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.progress = data.progress;
    this.bytesTransferred = data.bytesTransferred;
    this.totalBytes = data.totalBytes;
  }

  public readonly serverId: string;
  public readonly progress: number;
  public readonly bytesTransferred: number;
  public readonly totalBytes: number;

  get eventName(): string {
    return "server.download.progress";
  }
}

export class ServerDownloadCompletedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; serverName?: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.serverName = data.serverName || data.serverId;
  }

  public readonly serverId: string;
  public readonly serverName: string;

  get eventName(): string {
    return "server.download.completed";
  }
}

export class ServerDownloadFailedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; error: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.error = data.error;
  }

  public readonly serverId: string;
  public readonly error: string;

  get eventName(): string {
    return "server.download.failed";
  }
}

export class ServerUploadStartedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; serverName?: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.serverName = data.serverName || data.serverId;
  }

  public readonly serverId: string;
  public readonly serverName: string;

  get eventName(): string {
    return "server.upload.started";
  }
}

export class ServerUploadProgressEvent extends BaseDomainEvent {
  constructor(data: {
    serverId: string;
    progress: number;
    bytesTransferred: number;
    totalBytes: number;
  }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.progress = data.progress;
    this.bytesTransferred = data.bytesTransferred;
    this.totalBytes = data.totalBytes;
  }

  public readonly serverId: string;
  public readonly progress: number;
  public readonly bytesTransferred: number;
  public readonly totalBytes: number;

  get eventName(): string {
    return "server.upload.progress";
  }
}

export class ServerUploadCompletedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; serverName?: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.serverName = data.serverName || data.serverId;
  }

  public readonly serverId: string;
  public readonly serverName: string;

  get eventName(): string {
    return "server.upload.completed";
  }
}

export class ServerUploadFailedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; error: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.error = data.error;
  }

  public readonly serverId: string;
  public readonly error: string;

  get eventName(): string {
    return "server.upload.failed";
  }
}

export class ServerDeletedFromR2Event extends BaseDomainEvent {
  constructor(data: { serverId: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
  }

  public readonly serverId: string;

  get eventName(): string {
    return "server.deletedFromR2";
  }
}

// ============================================
// SERVER LOCKING EVENTS
// ============================================

export class ServerLockCreatedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; username: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.username = data.username;
    this.timestamp = new Date();
  }

  public readonly serverId: string;
  public readonly username: string;
  public readonly timestamp: Date;

  get eventName(): string {
    return "server.lock.created";
  }
}

export class ServerLockUploadedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
  }

  public readonly serverId: string;

  get eventName(): string {
    return "server.lock.uploaded";
  }
}

export class ServerLockReleasedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
  }

  public readonly serverId: string;

  get eventName(): string {
    return "server.lock.released";
  }
}

export class ServerLockDetectedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; username: string; timestamp: Date }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.username = data.username;
    this.timestamp = data.timestamp;
  }

  public readonly serverId: string;
  public readonly username: string;
  public readonly timestamp: Date;

  get eventName(): string {
    return "server.lock.detected";
  }
}

// ============================================
// SESSION TRACKING EVENTS
// ============================================

export class SessionStartedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; username: string; timestamp: Date }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.username = data.username;
    this.timestamp = data.timestamp;
  }

  public readonly serverId: string;
  public readonly username: string;
  public readonly timestamp: Date;

  get eventName(): string {
    return "session.started";
  }
}

export class SessionEndedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string; username: string; timestamp: Date }) {
    super(data.serverId);
    this.serverId = data.serverId;
    this.username = data.username;
    this.timestamp = data.timestamp;
  }

  public readonly serverId: string;
  public readonly username: string;
  public readonly timestamp: Date;

  get eventName(): string {
    return "session.ended";
  }
}

export class SessionUploadedEvent extends BaseDomainEvent {
  constructor(data: { serverId: string }) {
    super(data.serverId);
    this.serverId = data.serverId;
  }

  public readonly serverId: string;

  get eventName(): string {
    return "session.uploaded";
  }
}

// ============================================
// SYSTEM RESOURCES EVENTS
// ============================================

export class RamConfiguredEvent extends BaseDomainEvent {
  constructor(
    public readonly minRam: number,
    public readonly maxRam: number
  ) {
    super();
  }

  get eventName(): string {
    return "ram.configured";
  }
}

export class NetworkConfiguredEvent extends BaseDomainEvent {
  constructor(
    public readonly ip: string,
    public readonly port: number
  ) {
    super();
  }

  get eventName(): string {
    return "network.configured";
  }
}

export class JavaDownloadStartedEvent extends BaseDomainEvent {
  constructor(public readonly version: number) {
    super();
  }

  get eventName(): string {
    return "java.download.started";
  }
}

export class JavaDownloadCompletedEvent extends BaseDomainEvent {
  constructor(public readonly version: number) {
    super();
  }

  get eventName(): string {
    return "java.download.completed";
  }
}

// ============================================
// APP CONFIGURATION EVENTS
// ============================================

export class LanguageChangedEvent extends BaseDomainEvent {
  constructor(data: { language: string }) {
    super();
    this.language = data.language;
  }

  public readonly language: string;

  get eventName(): string {
    return "language.changed";
  }
}

export class UsernameChangedEvent extends BaseDomainEvent {
  constructor(data: { username: string }) {
    super();
    this.username = data.username;
  }

  public readonly username: string;

  get eventName(): string {
    return "username.changed";
  }
}

export class RamConfigChangedEvent extends BaseDomainEvent {
  constructor(data: { minRam: number; maxRam: number }) {
    super();
    this.minRam = data.minRam;
    this.maxRam = data.maxRam;
  }

  public readonly minRam: number;
  public readonly maxRam: number;

  get eventName(): string {
    return "ramConfig.changed";
  }
}

export class ConfigurationSavedEvent extends BaseDomainEvent {
  constructor() {
    super();
  }

  get eventName(): string {
    return "configuration.saved";
  }
}
