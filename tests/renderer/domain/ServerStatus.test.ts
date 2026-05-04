import { describe, expect, it } from "vitest";
import {
  ServerStatus as AppServerStatus,
  canTransitionServerStatus as canTransitionAppServerStatus,
} from "../../../src/renderer/src/domain/entities/ServerStatus";
import {
  ServerStatus as RuntimeServerStatus,
  canTransitionServerStatus as canTransitionRuntimeServerStatus,
} from "../../../src/renderer/src/contexts/server-runtime/domain/entities/ServerStatus";

describe("ServerStatus renderer exports", () => {
  it("re-exports the same enum values in both modules", () => {
    expect(AppServerStatus).toEqual(RuntimeServerStatus);
    expect(AppServerStatus.STOPPED).toBe("stopped");
    expect(AppServerStatus.STARTING).toBe("starting");
    expect(AppServerStatus.RUNNING).toBe("running");
    expect(AppServerStatus.STOPPING).toBe("stopping");
  });

  it("uses the same transition rules in both modules", () => {
    const transitions: Array<[AppServerStatus, AppServerStatus]> = [
      [AppServerStatus.STOPPED, AppServerStatus.STARTING],
      [AppServerStatus.STARTING, AppServerStatus.RUNNING],
      [AppServerStatus.RUNNING, AppServerStatus.STOPPING],
      [AppServerStatus.STOPPING, AppServerStatus.STOPPED],
      [AppServerStatus.STOPPED, AppServerStatus.RUNNING],
      [AppServerStatus.RUNNING, AppServerStatus.STARTING],
    ];

    for (const [from, to] of transitions) {
      expect(canTransitionAppServerStatus(from, to)).toBe(
        canTransitionRuntimeServerStatus(from, to),
      );
    }
  });
});
