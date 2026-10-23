import { useMemo } from "react";
import { appContainer } from "@shared/di";

/**
 * Hook to get a dependency from the DI container
 * Uses useMemo to avoid calling setState in effect
 * @param symbol The symbol identifier for the dependency
 * @returns The resolved dependency or null if not ready
 */
export function useDependency<T>(symbol: symbol): T | null {
  const dependency = useMemo(() => {
    try {
      return appContainer.get<T>(symbol);
    } catch (error) {
      console.error(`Failed to resolve dependency:`, error);
      return null;
    }
  }, [symbol]);

  return dependency;
}
