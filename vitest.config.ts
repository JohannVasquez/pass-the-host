import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "out", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/contexts/shared/**/*.ts",
        "src/main/config.ts",
        "src/main/contexts/**/application/**/*.ts",
        "src/main/contexts/**/domain/entities/ServerProcess.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/index.ts",
        "**/types.ts",
        "**/di/**",
        "**/infrastructure/ipc/**",
        "**/repositories/**",
        "**/domain/entities/AppConfig.ts",
        "**/domain/entities/R2Config.ts",
        "**/domain/entities/ServerLock.ts",
        "**/domain/entities/SessionMetadata.ts",
        "**/domain/entities/ServerConfig.ts",
        "**/domain/entities/ServerRuntimeConfig.ts",
        "**/domain/entities/SystemResources.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/contexts/shared"),
      "@main": resolve(__dirname, "src/main"),
    },
  },
});
