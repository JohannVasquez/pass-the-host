import "reflect-metadata";
import { Container } from "inversify";
import { configureServerRuntimeContext } from "../contexts/server-runtime/di/container";
import { configureCloudStorageContext } from "../contexts/cloud-storage/di/container";
import { configureServerLifecycleContainer } from "../contexts/server-lifecycle/di/container";
import { configureSystemResourcesContext } from "../contexts/system-resources/di/container";
import { configureAppConfigurationContext } from "../contexts/app-configuration/di/container";

const mainContainer = new Container();

// Load all context configurations
export function initializeMainContainer(): Container {
  configureServerRuntimeContext(mainContainer);
  configureCloudStorageContext(mainContainer);
  configureServerLifecycleContainer(mainContainer);
  configureSystemResourcesContext(mainContainer);
  configureAppConfigurationContext(mainContainer);
  return mainContainer;
}

export { mainContainer };
