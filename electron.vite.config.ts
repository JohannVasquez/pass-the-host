import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/contexts/shared"),
        "@contexts": resolve("src/renderer/src/contexts"),
        "@server-lifecycle": resolve("src/renderer/src/contexts/server-lifecycle"),
        "@server-runtime": resolve("src/renderer/src/contexts/server-runtime"),
        "@cloud-storage": resolve("src/renderer/src/contexts/cloud-storage"),
        "@server-locking": resolve("src/renderer/src/contexts/server-locking"),
        "@session-tracking": resolve("src/renderer/src/contexts/session-tracking"),
        "@system-resources": resolve("src/renderer/src/contexts/system-resources"),
        "@app-configuration": resolve("src/renderer/src/contexts/app-configuration"),
      },
    },
    plugins: [react()],
  },
});
