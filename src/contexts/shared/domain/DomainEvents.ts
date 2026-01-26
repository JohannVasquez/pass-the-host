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
  constructor(
    public readonly endpoint: string,
    public readonly bucket: string
  ) {
    super();
  }

  get eventName(): string {
    return "r2.configured";
  }
}

export class ServerDownloadStartedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly serverName: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.download.started";
  }
}

export class ServerDownloadProgressEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly progress: number,
    public readonly bytesTransferred: number,
    public readonly totalBytes: number
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.download.progress";
  }
}

export class ServerDownloadCompletedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly serverName: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.download.completed";
  }
}

export class ServerUploadStartedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly serverName: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.upload.started";
  }
}

export class ServerUploadProgressEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly progress: number,
    public readonly bytesTransferred: number,
    public readonly totalBytes: number
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.upload.progress";
  }
}

export class ServerUploadCompletedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly serverName: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.upload.completed";
  }
}

// ============================================
// SERVER LOCKING EVENTS
// ============================================

export class ServerLockCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly username: string,
    public readonly timestamp: Date
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.lock.created";
  }
}

export class ServerLockReleasedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly username: string
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.lock.released";
  }
}

export class ServerLockDetectedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly username: string,
    public readonly timestamp: Date
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.lock.detected";
  }
}

// ============================================
// SESSION TRACKING EVENTS
// ============================================

export class SessionStartedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly sessionId: string,
    public readonly startTime: Date
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "session.started";
  }
}

export class SessionEndedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly sessionId: string,
    public readonly endTime: Date,
    public readonly duration: number
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "session.ended";
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
  constructor(public readonly language: string) {
    super();
  }

  get eventName(): string {
    return "language.changed";
  }
}

export class UsernameChangedEvent extends BaseDomainEvent {
  constructor(public readonly username: string) {
    super();
  }

  get eventName(): string {
    return "username.changed";
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
