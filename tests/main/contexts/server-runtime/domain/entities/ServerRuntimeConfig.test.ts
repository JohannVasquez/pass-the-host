import { describe, it, expect } from "vitest";
import type {
  ServerRuntimeConfig,
  ForgeJvmArgs,
} from "../../../../../../src/main/contexts/server-runtime/domain/entities/ServerRuntimeConfig";

describe("ServerRuntimeConfig", () => {
  describe("interface", () => {
    it("should allow creating a config with required properties", () => {
      const config: ServerRuntimeConfig = {
        workingDir: "/path/to/server",
        command: "java",
        args: ["-jar", "server.jar", "nogui"],
      };

      expect(config.workingDir).toBe("/path/to/server");
      expect(config.command).toBe("java");
      expect(config.args).toEqual(["-jar", "server.jar", "nogui"]);
    });

    it("should allow creating a config with optional autoAcceptEula", () => {
      const config: ServerRuntimeConfig = {
        workingDir: "/path/to/server",
        command: "java",
        args: ["-jar", "server.jar"],
        autoAcceptEula: true,
      };

      expect(config.autoAcceptEula).toBe(true);
    });

    it("should allow autoAcceptEula to be undefined", () => {
      const config: ServerRuntimeConfig = {
        workingDir: "/path/to/server",
        command: "java",
        args: [],
      };

      expect(config.autoAcceptEula).toBeUndefined();
    });

    it("should support empty args array", () => {
      const config: ServerRuntimeConfig = {
        workingDir: "/server",
        command: "start.sh",
        args: [],
      };

      expect(config.args).toHaveLength(0);
    });

    it("should support multiple args", () => {
      const config: ServerRuntimeConfig = {
        workingDir: "/server",
        command: "java",
        args: ["-Xmx4G", "-Xms2G", "-jar", "server.jar", "nogui"],
      };

      expect(config.args).toHaveLength(5);
      expect(config.args[0]).toBe("-Xmx4G");
      expect(config.args[4]).toBe("nogui");
    });
  });
});

describe("ForgeJvmArgs", () => {
  describe("interface", () => {
    it("should allow creating with all arguments", () => {
      const forgeArgs: ForgeJvmArgs = {
        allArgs: ["-Xmx4G", "-Xms2G", "-XX:+UseG1GC"],
        minRam: "2G",
        maxRam: "4G",
      };

      expect(forgeArgs.allArgs).toHaveLength(3);
      expect(forgeArgs.minRam).toBe("2G");
      expect(forgeArgs.maxRam).toBe("4G");
    });

    it("should allow minRam and maxRam to be undefined", () => {
      const forgeArgs: ForgeJvmArgs = {
        allArgs: ["-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled"],
      };

      expect(forgeArgs.minRam).toBeUndefined();
      expect(forgeArgs.maxRam).toBeUndefined();
    });

    it("should support empty allArgs array", () => {
      const forgeArgs: ForgeJvmArgs = {
        allArgs: [],
      };

      expect(forgeArgs.allArgs).toHaveLength(0);
    });

    it("should support only maxRam being defined", () => {
      const forgeArgs: ForgeJvmArgs = {
        allArgs: ["-Xmx8G"],
        maxRam: "8G",
      };

      expect(forgeArgs.maxRam).toBe("8G");
      expect(forgeArgs.minRam).toBeUndefined();
    });

    it("should support only minRam being defined", () => {
      const forgeArgs: ForgeJvmArgs = {
        allArgs: ["-Xms1G"],
        minRam: "1G",
      };

      expect(forgeArgs.minRam).toBe("1G");
      expect(forgeArgs.maxRam).toBeUndefined();
    });

    it("should support various RAM format strings", () => {
      const forgeArgs: ForgeJvmArgs = {
        allArgs: ["-Xmx16384M", "-Xms4096M"],
        minRam: "4096M",
        maxRam: "16384M",
      };

      expect(forgeArgs.minRam).toBe("4096M");
      expect(forgeArgs.maxRam).toBe("16384M");
    });
  });
});
