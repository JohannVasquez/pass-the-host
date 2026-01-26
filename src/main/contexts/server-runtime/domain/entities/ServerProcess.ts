import { ChildProcessWithoutNullStreams } from "child_process";

export class ServerProcess {
  constructor(
    private readonly _serverId: string,
    private readonly _process: ChildProcessWithoutNullStreams
  ) {}

  get serverId(): string {
    return this._serverId;
  }

  get process(): ChildProcessWithoutNullStreams {
    return this._process;
  }

  get isRunning(): boolean {
    return !this._process.killed;
  }

  sendCommand(command: string): boolean {
    try {
      if (!this.isRunning) return false;
      this._process.stdin.write(`${command}\n`);
      return true;
    } catch {
      return false;
    }
  }

  stop(gracefulTimeout: number = 8000): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        resolve(false);
        return;
      }

      try {
        // Send 'stop' command for graceful shutdown
        this._process.stdin.write("stop\n");

        setTimeout(() => {
          if (!this._process.killed) {
            this._process.kill();
          }
          resolve(true);
        }, gracefulTimeout);
      } catch {
        try {
          this._process.kill();
        } catch {}
        resolve(false);
      }
    });
  }
}
