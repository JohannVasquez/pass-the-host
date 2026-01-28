import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServerProcess } from "../../../../../../src/main/contexts/server-runtime/domain/entities/ServerProcess";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "events";

// Mock ChildProcessWithoutNullStreams
function createMockProcess(killed: boolean = false): ChildProcessWithoutNullStreams {
  const stdin = {
    write: vi.fn().mockReturnValue(true),
  };

  const mockProcess = {
    stdin,
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    pid: 12345,
    killed,
    kill: vi.fn().mockImplementation(function (this: { killed: boolean }) {
      this.killed = true;
      return true;
    }),
  } as unknown as ChildProcessWithoutNullStreams;

  return mockProcess;
}

describe("ServerProcess", () => {
  describe("constructor", () => {
    it("should create a ServerProcess instance with serverId and process", () => {
      const mockProcess = createMockProcess();
      const serverProcess = new ServerProcess("server-1", mockProcess);

      expect(serverProcess.serverId).toBe("server-1");
      expect(serverProcess.process).toBe(mockProcess);
    });
  });

  describe("serverId", () => {
    it("should return the server ID", () => {
      const mockProcess = createMockProcess();
      const serverProcess = new ServerProcess("test-server-123", mockProcess);

      expect(serverProcess.serverId).toBe("test-server-123");
    });
  });

  describe("process", () => {
    it("should return the underlying child process", () => {
      const mockProcess = createMockProcess();
      const serverProcess = new ServerProcess("server-1", mockProcess);

      expect(serverProcess.process).toBe(mockProcess);
    });
  });

  describe("isRunning", () => {
    it("should return true when process is not killed", () => {
      const mockProcess = createMockProcess(false);
      const serverProcess = new ServerProcess("server-1", mockProcess);

      expect(serverProcess.isRunning).toBe(true);
    });

    it("should return false when process is killed", () => {
      const mockProcess = createMockProcess(true);
      const serverProcess = new ServerProcess("server-1", mockProcess);

      expect(serverProcess.isRunning).toBe(false);
    });
  });

  describe("sendCommand", () => {
    it("should send command to stdin when process is running", () => {
      const mockProcess = createMockProcess(false);
      const serverProcess = new ServerProcess("server-1", mockProcess);

      const result = serverProcess.sendCommand("say Hello World");

      expect(result).toBe(true);
      expect(mockProcess.stdin.write).toHaveBeenCalledWith("say Hello World\n");
    });

    it("should return false when process is not running", () => {
      const mockProcess = createMockProcess(true);
      const serverProcess = new ServerProcess("server-1", mockProcess);

      const result = serverProcess.sendCommand("say Hello");

      expect(result).toBe(false);
      expect(mockProcess.stdin.write).not.toHaveBeenCalled();
    });

    it("should return false when stdin.write throws", () => {
      const mockProcess = createMockProcess(false);
      (mockProcess.stdin.write as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Write error");
      });
      const serverProcess = new ServerProcess("server-1", mockProcess);

      const result = serverProcess.sendCommand("say Hello");

      expect(result).toBe(false);
    });

    it("should append newline to the command", () => {
      const mockProcess = createMockProcess(false);
      const serverProcess = new ServerProcess("server-1", mockProcess);

      serverProcess.sendCommand("help");

      expect(mockProcess.stdin.write).toHaveBeenCalledWith("help\n");
    });
  });

  describe("stop", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("should send stop command and kill process after timeout", async () => {
      const mockProcess = createMockProcess(false);
      const serverProcess = new ServerProcess("server-1", mockProcess);

      const stopPromise = serverProcess.stop(1000);

      expect(mockProcess.stdin.write).toHaveBeenCalledWith("stop\n");

      vi.advanceTimersByTime(1000);

      const result = await stopPromise;
      expect(result).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it("should return false when process is already not running", async () => {
      const mockProcess = createMockProcess(true);
      const serverProcess = new ServerProcess("server-1", mockProcess);

      const result = await serverProcess.stop();

      expect(result).toBe(false);
      expect(mockProcess.stdin.write).not.toHaveBeenCalled();
    });

    it("should use default gracefulTimeout of 8000ms", async () => {
      const mockProcess = createMockProcess(false);
      const serverProcess = new ServerProcess("server-1", mockProcess);

      const stopPromise = serverProcess.stop();

      // Advance less than 8000ms - should not resolve yet
      vi.advanceTimersByTime(7999);

      // Advance to 8000ms
      vi.advanceTimersByTime(1);

      const result = await stopPromise;
      expect(result).toBe(true);
    });

    it("should return false when stdin.write throws", async () => {
      const mockProcess = createMockProcess(false);
      (mockProcess.stdin.write as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Write error");
      });
      const serverProcess = new ServerProcess("server-1", mockProcess);

      const result = await serverProcess.stop();

      expect(result).toBe(false);
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it("should handle kill error gracefully when stdin.write throws", async () => {
      const mockProcess = createMockProcess(false);
      (mockProcess.stdin.write as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Write error");
      });
      (mockProcess.kill as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Kill error");
      });
      const serverProcess = new ServerProcess("server-1", mockProcess);

      const result = await serverProcess.stop();

      expect(result).toBe(false);
    });

    afterEach(() => {
      vi.useRealTimers();
    });
  });
});
