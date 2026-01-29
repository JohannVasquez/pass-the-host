import { describe, it, expect } from "vitest";
import {
  ServerCreatedEvent,
  ServerDeletedEvent,
  ServerSelectedEvent,
  ServerStartingEvent,
  ServerStartedEvent,
  ServerStoppingEvent,
  ServerStoppedEvent,
  ServerCommandExecutedEvent,
  ServerLogReceivedEvent,
  R2ConfiguredEvent,
  R2ConnectionTestedEvent,
  ServerDownloadStartedEvent,
  ServerDownloadProgressEvent,
  ServerDownloadCompletedEvent,
  ServerDownloadFailedEvent,
  ServerUploadStartedEvent,
  ServerUploadProgressEvent,
  ServerUploadCompletedEvent,
  ServerUploadFailedEvent,
  ServerDeletedFromR2Event,
  ServerLockCreatedEvent,
  ServerLockUploadedEvent,
  ServerLockReleasedEvent,
  ServerLockDetectedEvent,
  SessionStartedEvent,
  SessionEndedEvent,
  SessionUploadedEvent,
  RamConfiguredEvent,
  NetworkConfiguredEvent,
  JavaDownloadStartedEvent,
  JavaDownloadCompletedEvent,
  LanguageChangedEvent,
  UsernameChangedEvent,
  RamConfigChangedEvent,
  ConfigurationSavedEvent,
} from "../../../../src/contexts/shared/domain/DomainEvents";

describe("DomainEvents", () => {
  describe("Server Lifecycle Events", () => {
    it("ServerCreatedEvent should have correct properties", () => {
      const event = new ServerCreatedEvent("server-1", "My Server", "vanilla");

      expect(event.eventName).toBe("server.created");
      expect(event.serverId).toBe("server-1");
      expect(event.serverName).toBe("My Server");
      expect(event.serverType).toBe("vanilla");
      expect(event.aggregateId).toBe("server-1");
      expect(event.occurredOn).toBeInstanceOf(Date);
    });

    it("ServerDeletedEvent should have correct properties", () => {
      const event = new ServerDeletedEvent("server-1", "My Server");

      expect(event.eventName).toBe("server.deleted");
      expect(event.serverId).toBe("server-1");
      expect(event.serverName).toBe("My Server");
    });

    it("ServerSelectedEvent should have correct properties", () => {
      const event = new ServerSelectedEvent("server-1", "My Server");

      expect(event.eventName).toBe("server.selected");
      expect(event.serverId).toBe("server-1");
      expect(event.serverName).toBe("My Server");
    });
  });

  describe("Server Runtime Events", () => {
    it("ServerStartingEvent should have correct properties", () => {
      const event = new ServerStartingEvent("server-1");

      expect(event.eventName).toBe("server.starting");
      expect(event.serverId).toBe("server-1");
    });

    it("ServerStartedEvent should have correct properties", () => {
      const event = new ServerStartedEvent("server-1");

      expect(event.eventName).toBe("server.started");
      expect(event.serverId).toBe("server-1");
    });

    it("ServerStoppingEvent should have correct properties", () => {
      const event = new ServerStoppingEvent("server-1");

      expect(event.eventName).toBe("server.stopping");
      expect(event.serverId).toBe("server-1");
    });

    it("ServerStoppedEvent should have correct properties", () => {
      const event = new ServerStoppedEvent("server-1");

      expect(event.eventName).toBe("server.stopped");
      expect(event.serverId).toBe("server-1");
    });

    it("ServerCommandExecutedEvent should have correct properties", () => {
      const event = new ServerCommandExecutedEvent("server-1", "say Hello");

      expect(event.eventName).toBe("server.command.executed");
      expect(event.serverId).toBe("server-1");
      expect(event.command).toBe("say Hello");
    });

    it("ServerLogReceivedEvent should have correct properties", () => {
      const event = new ServerLogReceivedEvent("server-1", "Server started", "info");

      expect(event.eventName).toBe("server.log.received");
      expect(event.serverId).toBe("server-1");
      expect(event.message).toBe("Server started");
      expect(event.type).toBe("info");
    });
  });

  describe("Cloud Storage Events", () => {
    it("R2ConfiguredEvent should have correct properties", () => {
      const event = new R2ConfiguredEvent({
        endpoint: "https://r2.example.com",
        bucket: "my-bucket",
        region: "auto",
      });

      expect(event.eventName).toBe("r2.configured");
      expect(event.endpoint).toBe("https://r2.example.com");
      expect(event.bucket).toBe("my-bucket");
      expect(event.region).toBe("auto");
    });

    it("R2ConnectionTestedEvent should have correct properties", () => {
      const event = new R2ConnectionTestedEvent({
        success: true,
        endpoint: "https://r2.example.com",
      });

      expect(event.eventName).toBe("r2.connection.tested");
      expect(event.success).toBe(true);
      expect(event.endpoint).toBe("https://r2.example.com");
    });

    it("ServerDownloadStartedEvent should have correct properties", () => {
      const event = new ServerDownloadStartedEvent({
        serverId: "server-1",
        serverName: "My Server",
      });

      expect(event.eventName).toBe("server.download.started");
      expect(event.serverId).toBe("server-1");
      expect(event.serverName).toBe("My Server");
    });

    it("ServerDownloadStartedEvent should use serverId as serverName when not provided", () => {
      const event = new ServerDownloadStartedEvent({ serverId: "server-1" });

      expect(event.serverName).toBe("server-1");
    });

    it("ServerDownloadProgressEvent should have correct properties", () => {
      const event = new ServerDownloadProgressEvent({
        serverId: "server-1",
        progress: 50,
        bytesTransferred: 5000,
        totalBytes: 10000,
      });

      expect(event.eventName).toBe("server.download.progress");
      expect(event.progress).toBe(50);
      expect(event.bytesTransferred).toBe(5000);
      expect(event.totalBytes).toBe(10000);
    });

    it("ServerDownloadCompletedEvent should have correct properties", () => {
      const event = new ServerDownloadCompletedEvent({
        serverId: "server-1",
        serverName: "My Server",
      });

      expect(event.eventName).toBe("server.download.completed");
      expect(event.serverId).toBe("server-1");
    });

    it("ServerDownloadFailedEvent should have correct properties", () => {
      const event = new ServerDownloadFailedEvent({
        serverId: "server-1",
        error: "Connection failed",
      });

      expect(event.eventName).toBe("server.download.failed");
      expect(event.error).toBe("Connection failed");
    });

    it("ServerUploadStartedEvent should have correct properties", () => {
      const event = new ServerUploadStartedEvent({
        serverId: "server-1",
        serverName: "My Server",
      });

      expect(event.eventName).toBe("server.upload.started");
      expect(event.serverId).toBe("server-1");
    });

    it("ServerUploadCompletedEvent should have correct properties", () => {
      const event = new ServerUploadCompletedEvent({
        serverId: "server-1",
        serverName: "My Server",
      });

      expect(event.eventName).toBe("server.upload.completed");
    });

    it("ServerUploadFailedEvent should have correct properties", () => {
      const event = new ServerUploadFailedEvent({
        serverId: "server-1",
        error: "Upload failed",
      });

      expect(event.eventName).toBe("server.upload.failed");
      expect(event.error).toBe("Upload failed");
    });

    it("ServerUploadProgressEvent should have correct properties", () => {
      const event = new ServerUploadProgressEvent({
        serverId: "server-1",
        progress: 75,
        bytesTransferred: 7500,
        totalBytes: 10000,
      });

      expect(event.eventName).toBe("server.upload.progress");
      expect(event.serverId).toBe("server-1");
      expect(event.progress).toBe(75);
      expect(event.bytesTransferred).toBe(7500);
      expect(event.totalBytes).toBe(10000);
    });

    it("ServerDeletedFromR2Event should have correct properties", () => {
      const event = new ServerDeletedFromR2Event({ serverId: "server-1" });

      expect(event.eventName).toBe("server.deletedFromR2");
      expect(event.serverId).toBe("server-1");
    });
  });

  describe("Server Locking Events", () => {
    it("ServerLockCreatedEvent should have correct properties", () => {
      const event = new ServerLockCreatedEvent({
        serverId: "server-1",
        username: "player1",
      });

      expect(event.eventName).toBe("server.lock.created");
      expect(event.serverId).toBe("server-1");
      expect(event.username).toBe("player1");
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it("ServerLockReleasedEvent should have correct properties", () => {
      const event = new ServerLockReleasedEvent({ serverId: "server-1" });

      expect(event.eventName).toBe("server.lock.released");
      expect(event.serverId).toBe("server-1");
    });

    it("ServerLockUploadedEvent should have correct properties", () => {
      const event = new ServerLockUploadedEvent({ serverId: "server-1" });

      expect(event.eventName).toBe("server.lock.uploaded");
      expect(event.serverId).toBe("server-1");
    });

    it("ServerLockDetectedEvent should have correct properties", () => {
      const timestamp = new Date();
      const event = new ServerLockDetectedEvent({
        serverId: "server-1",
        username: "player1",
        timestamp,
      });

      expect(event.eventName).toBe("server.lock.detected");
      expect(event.serverId).toBe("server-1");
      expect(event.username).toBe("player1");
      expect(event.timestamp).toBe(timestamp);
    });
  });

  describe("Session Tracking Events", () => {
    it("SessionStartedEvent should have correct properties", () => {
      const timestamp = new Date();
      const event = new SessionStartedEvent({
        serverId: "server-1",
        username: "player1",
        timestamp,
      });

      expect(event.eventName).toBe("session.started");
      expect(event.serverId).toBe("server-1");
      expect(event.username).toBe("player1");
      expect(event.timestamp).toBe(timestamp);
    });

    it("SessionEndedEvent should have correct properties", () => {
      const timestamp = new Date();
      const event = new SessionEndedEvent({
        serverId: "server-1",
        username: "player1",
        timestamp,
      });

      expect(event.eventName).toBe("session.ended");
      expect(event.serverId).toBe("server-1");
      expect(event.username).toBe("player1");
    });

    it("SessionUploadedEvent should have correct properties", () => {
      const event = new SessionUploadedEvent({ serverId: "server-1" });

      expect(event.eventName).toBe("session.uploaded");
      expect(event.serverId).toBe("server-1");
    });
  });

  describe("System Resources Events", () => {
    it("RamConfiguredEvent should have correct properties", () => {
      const event = new RamConfiguredEvent(2, 8);

      expect(event.eventName).toBe("ram.configured");
      expect(event.minRam).toBe(2);
      expect(event.maxRam).toBe(8);
    });

    it("NetworkConfiguredEvent should have correct properties", () => {
      const event = new NetworkConfiguredEvent("192.168.1.100", 25565);

      expect(event.eventName).toBe("network.configured");
      expect(event.ip).toBe("192.168.1.100");
      expect(event.port).toBe(25565);
    });

    it("JavaDownloadStartedEvent should have correct properties", () => {
      const event = new JavaDownloadStartedEvent(21);

      expect(event.eventName).toBe("java.download.started");
      expect(event.version).toBe(21);
    });

    it("JavaDownloadCompletedEvent should have correct properties", () => {
      const event = new JavaDownloadCompletedEvent(21);

      expect(event.eventName).toBe("java.download.completed");
      expect(event.version).toBe(21);
    });
  });

  describe("App Configuration Events", () => {
    it("LanguageChangedEvent should have correct properties", () => {
      const event = new LanguageChangedEvent({ language: "es" });

      expect(event.eventName).toBe("language.changed");
      expect(event.language).toBe("es");
    });

    it("UsernameChangedEvent should have correct properties", () => {
      const event = new UsernameChangedEvent({ username: "NewPlayer" });

      expect(event.eventName).toBe("username.changed");
      expect(event.username).toBe("NewPlayer");
    });

    it("ConfigurationSavedEvent should have correct eventName", () => {
      const event = new ConfigurationSavedEvent();

      expect(event.eventName).toBe("configuration.saved");
    });

    it("RamConfigChangedEvent should have correct properties", () => {
      const event = new RamConfigChangedEvent({ minRam: 2, maxRam: 8 });

      expect(event.eventName).toBe("ramConfig.changed");
      expect(event.minRam).toBe(2);
      expect(event.maxRam).toBe(8);
    });
  });
});
