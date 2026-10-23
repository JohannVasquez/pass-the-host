import "reflect-metadata";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { appContainer } from "@shared/di";
import { configureServerLifecycle } from "@server-lifecycle/di";
import { configureServerRuntime } from "@server-runtime/di";
import { configureCloudStorage } from "@cloud-storage/di";
import { configureServerLocking } from "@server-locking/di";
import { configureSystemResources } from "@system-resources/di";
import { configureSessionTracking } from "@session-tracking/di";
import { configureAppConfiguration } from "@app-configuration/di";

// Bind every context before the first render so useDependency can resolve on mount.
appContainer.loadModules(
  configureServerLifecycle,
  configureServerRuntime,
  configureCloudStorage,
  configureServerLocking,
  configureSystemResources,
  configureSessionTracking,
  configureAppConfiguration,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
