import { useEffect, useState } from "react";
import { appContainer } from "@shared/di";
import { configureServerLifecycle } from "@server-lifecycle/di";
import { configureServerRuntime } from "@server-runtime/di";
import { configureCloudStorage } from "@cloud-storage/di";
import { configureServerLocking } from "@server-locking/di";
import { configureSystemResources } from "@system-resources/di";
import { configureSessionTracking } from "@session-tracking/di";
import { configureAppConfiguration } from "@app-configuration/di";

/**
 * Hook to get a dependency from the DI container
 * @param symbol The symbol identifier for the dependency
 * @returns The resolved dependency or null if not ready
 */
export function useDependency<T>(symbol: symbol): T | null {
  const [dependency, setDependency] = useState<T | null>(null);

  useEffect(() => {
    try {
      const resolved = appContainer.get<T>(symbol);
      setDependency(resolved);
    } catch (error) {
      console.error(`Failed to resolve dependency:`, error);
      setDependency(null);
    }
  }, [symbol]);

  return dependency;
}

/**
 * Hook to check if container is initialized
 */
export function useContainerReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initContainer = (): void => {
      try {
        // Load all context configurations
        appContainer.loadModules(
          configureServerLifecycle,
          configureServerRuntime,
          configureCloudStorage,
          configureServerLocking,
          configureSystemResources,
          configureSessionTracking,
          configureAppConfiguration,
        );
        setReady(true);
      } catch (error) {
        console.error("Failed to initialize container:", error);
        setReady(false);
      }
    };

    initContainer();
  }, []);

  return ready;
}
