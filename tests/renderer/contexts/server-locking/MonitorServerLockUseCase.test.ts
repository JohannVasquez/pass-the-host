import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonitorServerLockUseCase } from "@renderer/contexts/server-locking/application/use-cases/MonitorServerLockUseCase";
import { EventBus } from "@shared/infrastructure/event-bus";

const config = {} as never;
const locked = { exists: true, lock: { username: "Ever", startedAt: new Date().toISOString() } };

describe("MonitorServerLockUseCase", () => {
  const detected = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    EventBus.getInstance().subscribe("server.lock.detected", detected);
  });

  afterEach(() => {
    EventBus.getInstance().unsubscribe("server.lock.detected", detected);
    detected.mockReset();
    vi.useRealTimers();
  });

  it("ignores a check of the previous server that resolves after switching", async () => {
    let resolveOld!: (value: typeof locked) => void;
    const check = {
      execute: vi
        .fn()
        .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
        .mockResolvedValue({ exists: false }),
    };
    const monitor = new MonitorServerLockUseCase(check as never);

    monitor.start(config, "ever-server");
    monitor.start(config, "free-server"); // the user selects another server
    resolveOld(locked);
    await vi.waitFor(() => expect(check.execute).toHaveBeenCalledTimes(2));
    await Promise.resolve();

    expect(detected).not.toHaveBeenCalled();
    monitor.stop();
  });

  it("still reports a lock on the server being monitored", async () => {
    const check = { execute: vi.fn().mockResolvedValue(locked) };
    const monitor = new MonitorServerLockUseCase(check as never);

    monitor.start(config, "ever-server");
    await vi.waitFor(() => expect(detected).toHaveBeenCalledTimes(1));
    monitor.stop();
  });
});
