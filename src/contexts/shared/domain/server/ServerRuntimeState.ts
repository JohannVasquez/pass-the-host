export enum ServerRuntimeState {
  STOPPED = "stopped",
  STARTING = "starting",
  RUNNING = "running",
  STOPPING = "stopping",
}

const ALLOWED_TRANSITIONS: Record<ServerRuntimeState, ServerRuntimeState[]> = {
  [ServerRuntimeState.STOPPED]: [ServerRuntimeState.STARTING],
  [ServerRuntimeState.STARTING]: [ServerRuntimeState.RUNNING, ServerRuntimeState.STOPPED],
  [ServerRuntimeState.RUNNING]: [ServerRuntimeState.STOPPING, ServerRuntimeState.STOPPED],
  [ServerRuntimeState.STOPPING]: [ServerRuntimeState.STOPPED],
};

export function canTransitionServerRuntimeState(
  from: ServerRuntimeState,
  to: ServerRuntimeState,
): boolean {
  if (from === to) {
    return true;
  }

  return ALLOWED_TRANSITIONS[from].includes(to);
}
