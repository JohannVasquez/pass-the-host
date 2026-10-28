import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerProcessRepository } from "@main/contexts/server-runtime/infrastructure/repositories/ServerProcessRepository";

let userDataPath = "";

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => userDataPath) },
  shell: { openPath: vi.fn() },
}));

describe("ServerProcessRepository.editForgeJvmArgs", () => {
  let jvmArgsPath = "";

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "ptp-jvm-"));
    fs.mkdirSync(path.join(userDataPath, "servers", "s1"), { recursive: true });
    jvmArgsPath = path.join(userDataPath, "servers", "s1", "user_jvm_args.txt");
  });

  it("sets RAM when the installer only ships it commented out", async () => {
    fs.writeFileSync(jvmArgsPath, "# For example: -Xmx4G\n# -Xmx4G\n");

    expect(await new ServerProcessRepository().editForgeJvmArgs("s1", 2, 6)).toBe(true);
    expect(fs.readFileSync(jvmArgsPath, "utf-8")).toBe(
      "# For example: -Xmx4G\n# -Xmx4G\n-Xms2G\n-Xmx6G\n",
    );
  });

  it("replaces active values on every run and keeps other flags", async () => {
    fs.writeFileSync(jvmArgsPath, "# note\r\n-Xmx4G -XX:+UseG1GC\r\n-Xms1024M\r\n");
    const repo = new ServerProcessRepository();

    await repo.editForgeJvmArgs("s1", 1, 3);
    await repo.editForgeJvmArgs("s1", 2, 8);

    expect(fs.readFileSync(jvmArgsPath, "utf-8")).toBe("# note\n-XX:+UseG1GC\n-Xms2G\n-Xmx8G\n");
  });
});
