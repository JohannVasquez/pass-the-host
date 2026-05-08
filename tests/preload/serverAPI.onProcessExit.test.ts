import { beforeEach, describe, expect, it, vi } from "vitest";

const exposeInMainWorldMock = vi.fn();
const onMock = vi.fn();
const removeListenerMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: exposeInMainWorldMock,
  },
  ipcRenderer: {
    on: onMock,
    removeListener: removeListenerMock,
    invoke: invokeMock,
  },
}));

vi.mock("@electron-toolkit/preload", () => ({
  electronAPI: {},
}));

describe("preload serverAPI.onProcessExit", () => {
  beforeEach(() => {
    exposeInMainWorldMock.mockReset();
    onMock.mockReset();
    removeListenerMock.mockReset();
    invokeMock.mockReset();
    vi.resetModules();
    Object.defineProperty(process, "contextIsolated", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  it("subscribes and unsubscribes process-exit listener", async () => {
    await import("../../src/preload/index");

    const serverApiExposeCall = exposeInMainWorldMock.mock.calls.find(
      ([key]) => key === "serverAPI",
    );
    expect(serverApiExposeCall).toBeDefined();

    const serverAPI = serverApiExposeCall?.[1] as {
      onProcessExit: (
        callback: (payload: { serverId: string; code: number | null }) => void,
      ) => () => void;
    };

    const callback = vi.fn();
    const unsubscribe = serverAPI.onProcessExit(callback);

    expect(onMock).toHaveBeenCalledOnce();
    expect(onMock.mock.calls[0]?.[0]).toBe("server:process-exit");

    const listener = onMock.mock.calls[0]?.[1] as (_event: unknown, payload: unknown) => void;
    listener({}, { serverId: "srv-1", code: 0 });

    expect(callback).toHaveBeenCalledWith({ serverId: "srv-1", code: 0 });

    unsubscribe();

    expect(removeListenerMock).toHaveBeenCalledWith("server:process-exit", listener);
  });
});
