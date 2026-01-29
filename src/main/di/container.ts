import "reflect-metadata";
import { Container } from "inversify";
import { configureServerRuntimeContext } from "@main/contexts/server-runtime/di/container";
import { configureCloudStorageContext } from "@main/contexts/cloud-storage/di/container";
import { configureServerLifecycleContainer } from "@main/contexts/server-lifecycle/di/container";
import { configureSystemResourcesContext } from "@main/contexts/system-resources/di/container";
import { configureAppConfigurationContext } from "@main/contexts/app-configuration/di/container";

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
