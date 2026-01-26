import { Container } from "inversify";
import "reflect-metadata";

/**
 * Main Inversify Container
 * This is where all contexts are registered
 */
export class AppContainer {
  private static instance: AppContainer;
  private container: Container;

  private constructor() {
    this.container = new Container({
      defaultScope: "Singleton",
    });
  }

  public static getInstance(): AppContainer {
    if (!AppContainer.instance) {
      AppContainer.instance = new AppContainer();
    }
    return AppContainer.instance;
  }

  public getContainer(): Container {
    return this.container;
  }

  /**
   * Register modules from all contexts
   * This method should be called with configuration functions from the renderer
   */
  public loadModules(...configureFunctions: Array<(container: Container) => void>): void {
    console.log("[AppContainer] Loading dependency injection modules...");

    try {
      configureFunctions.forEach((configure, index) => {
        configure(this.container);
        console.log(`[AppContainer] ✓ Module ${index + 1} loaded`);
      });

      console.log("[AppContainer] All modules loaded successfully");
    } catch (error) {
      console.error("[AppContainer] Error loading modules:", error);
      throw error;
    }
  }

  /**
   * Get a dependency from the container
   */
  public get<T>(serviceIdentifier: symbol): T {
    return this.container.get<T>(serviceIdentifier);
  }

  /**
   * Bind a dependency to the container
   */
  public bind<T>(serviceIdentifier: symbol): any {
    return this.container.bind<T>(serviceIdentifier);
  }

  /**
   * Unbind a dependency from the container
   */
  public unbind(serviceIdentifier: symbol): void {
    this.container.unbind(serviceIdentifier);
  }

  /**
   * Check if a dependency is bound
   */
  public isBound(serviceIdentifier: symbol): boolean {
    return this.container.isBound(serviceIdentifier);
  }

  /**
   * Clear all bindings (useful for testing)
   */
  public clear(): void {
    this.container.unbindAll();
  }
}

/**
 * Export singleton instance
 */
export const appContainer = AppContainer.getInstance();
