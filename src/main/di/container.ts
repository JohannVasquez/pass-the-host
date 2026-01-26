import "reflect-metadata";
import { Container } from "inversify";
import { configureServerRuntimeContext } from "./contexts/server-runtime/di/container";
import { configureCloudStorageContext } from "./contexts/cloud-storage/di/container";

const mainContainer = new Container();

// Load all context configurations
export function initializeMainContainer(): Container {
  configureServerRuntimeContext(mainContainer);
  configureCloudStorageContext(mainContainer);
  // Add more contexts here as they are implemented
  return mainContainer;
}

export { mainContainer };
