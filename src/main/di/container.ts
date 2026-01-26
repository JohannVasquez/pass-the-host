import "reflect-metadata";
import { Container } from "inversify";
import { configureServerRuntimeContext } from "./contexts/server-runtime/di/container";

const mainContainer = new Container();

// Load all context configurations
export function initializeMainContainer(): Container {
  configureServerRuntimeContext(mainContainer);
  // Add more contexts here as they are implemented
  return mainContainer;
}

export { mainContainer };
