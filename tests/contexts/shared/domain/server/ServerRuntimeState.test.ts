import { describe, expect, it } from "vitest";
import {
  ServerRuntimeState,
  canTransitionServerRuntimeState,
} from "@shared/domain/server/ServerRuntimeState";

describe("ServerRuntimeState", () => {
  it("allows valid forward transitions", () => {
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STOPPED, ServerRuntimeState.STARTING),
    ).toBe(true);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STARTING, ServerRuntimeState.RUNNING),
    ).toBe(true);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.RUNNING, ServerRuntimeState.STOPPING),
    ).toBe(true);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STOPPING, ServerRuntimeState.STOPPED),
    ).toBe(true);
  });

  it("allows expected rollback transitions", () => {
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STARTING, ServerRuntimeState.STOPPED),
    ).toBe(true);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.RUNNING, ServerRuntimeState.STOPPED),
    ).toBe(true);
  });

  it("allows idempotent transitions", () => {
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STOPPED, ServerRuntimeState.STOPPED),
    ).toBe(true);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STARTING, ServerRuntimeState.STARTING),
    ).toBe(true);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.RUNNING, ServerRuntimeState.RUNNING),
    ).toBe(true);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STOPPING, ServerRuntimeState.STOPPING),
    ).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STOPPED, ServerRuntimeState.RUNNING),
    ).toBe(false);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STOPPED, ServerRuntimeState.STOPPING),
    ).toBe(false);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STARTING, ServerRuntimeState.STOPPING),
    ).toBe(false);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.RUNNING, ServerRuntimeState.STARTING),
    ).toBe(false);
    expect(
      canTransitionServerRuntimeState(ServerRuntimeState.STOPPING, ServerRuntimeState.RUNNING),
    ).toBe(false);
  });
});
