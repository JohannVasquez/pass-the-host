import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
  app: {
    getPath: vi.fn().mockReturnValue("/tmp/user-data"),
  },
}));

describe("ServerRuntimeIPCHandlers", () => {
  beforeEach(() => {
    handleMock.mockReset();
  });

  it("emits process exit event when spawned process closes", async () => {
    const executeSpawn = vi.fn().mockImplementation(async (_id, _cfg, _out, _err, onClose) => {
      onClose?.(137);
    });

    const { ServerRuntimeIPCHandlers } =
      await import("../../../../../../src/main/contexts/server-runtime/infrastructure/ipc/ServerRuntimeIPCHandlers");

    const handlers = new ServerRuntimeIPCHandlers(
      { execute: executeSpawn } as never,
      { execute: vi.fn() } as never,
      { execute: vi.fn() } as never,
      { execute: vi.fn() } as never,
      { execute: vi.fn() } as never,
      { execute: vi.fn() } as never,
    );

    handlers.register();

    const spawnRegistration = handleMock.mock.calls.find(
      ([channel]) => channel === "server:spawn-server-process",
    );
    expect(spawnRegistration).toBeDefined();

    const spawnHandler = spawnRegistration?.[1] as (
      event: {
        sender: { isDestroyed: () => boolean; send: (channel: string, payload: unknown) => void };
      },
      serverId: string,
      command: string,
      args: string[],
      workingDir: string,
    ) => Promise<boolean>;

    const sendMock = vi.fn();
    const event = {
      sender: {
        isDestroyed: () => false,
        send: sendMock,
      },
    };

    const result = await spawnHandler(event, "srv-1", "java", ["-jar", "server.jar"], "/tmp/srv-1");

    expect(result).toBe(true);
    expect(executeSpawn).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith("server:process-exit", { serverId: "srv-1", code: 137 });
  });
});
