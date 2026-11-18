import { Container } from "inversify";
import { shell } from "electron";
import { TYPES } from "@main/contexts/discord-notifications/application/use-cases/types";
import { TYPES as ConfigTYPES } from "@main/contexts/app-configuration/application/use-cases/types";
import { LoadConfigUseCase } from "@main/contexts/app-configuration/application/use-cases";
import {
  IDiscordWebhookRepository,
  IServerDiscordSettingsRepository,
} from "@main/contexts/discord-notifications/domain/repositories";
import {
  DiscordWebhookRepository,
  ServerDiscordSettingsRepository,
} from "@main/contexts/discord-notifications/infrastructure/repositories";
import { DiscordLinkService } from "@main/contexts/discord-notifications/application/DiscordLinkService";
import { DiscordBridge } from "@main/contexts/discord-notifications/application/DiscordBridge";
import { SendCommandUseCase } from "@main/contexts/server-runtime/application/use-cases";
import {
  API_URL,
  api,
  deviceToken,
} from "@main/contexts/p2p-tunnel/infrastructure/DeviceSession";
import {
  GetServerDiscordSettingsUseCase,
  RelayServerOutputUseCase,
  SaveServerDiscordSettingsUseCase,
  SendDiscordTestMessageUseCase,
} from "@main/contexts/discord-notifications/application/use-cases";

export function configureDiscordNotificationsContext(container: Container): void {
  container
    .bind<IDiscordWebhookRepository>(TYPES.IDiscordWebhookRepository)
    .toDynamicValue(() => new DiscordWebhookRepository())
    .inSingletonScope();

  container
    .bind<IServerDiscordSettingsRepository>(TYPES.IServerDiscordSettingsRepository)
    .toDynamicValue(() => new ServerDiscordSettingsRepository())
    .inSingletonScope();

  container
    .bind<DiscordLinkService>(TYPES.DiscordLinkService)
    .toDynamicValue(
      () =>
        new DiscordLinkService(
          container.get<IServerDiscordSettingsRepository>(TYPES.IServerDiscordSettingsRepository),
          api,
          (url) => shell.openExternal(url),
        ),
    )
    .inSingletonScope();

  container
    .bind<DiscordBridge>(TYPES.DiscordBridge)
    .toDynamicValue(() => {
      const settings = container.get<IServerDiscordSettingsRepository>(
        TYPES.IServerDiscordSettingsRepository,
      );
      return new DiscordBridge({
        loadSettings: (serverId) => settings.get(serverId),
        serverVersion: (serverId) => settings.serverVersion(serverId),
        // Resolved per message: the server-runtime context is registered independently
        sendCommand: (serverId, command) =>
          container.get(SendCommandUseCase).execute(serverId, command),
        apiUrl: API_URL,
        deviceToken,
      });
    })
    .inSingletonScope();

  container
    .bind<RelayServerOutputUseCase>(TYPES.RelayServerOutputUseCase)
    .toDynamicValue(() => {
      const settings = container.get<IServerDiscordSettingsRepository>(
        TYPES.IServerDiscordSettingsRepository,
      );
      return new RelayServerOutputUseCase(
        container.get<IDiscordWebhookRepository>(TYPES.IDiscordWebhookRepository),
        (serverId) => settings.get(serverId),
        (serverId) => settings.serverName(serverId),
        async () =>
          (await container.get<LoadConfigUseCase>(ConfigTYPES.LoadConfigUseCase).execute())?.app
            ?.owner_name,
        (serverId, event) => container.get<DiscordBridge>(TYPES.DiscordBridge).onLifecycle(serverId, event),
      );
    })
    .inSingletonScope();

  container
    .bind<SendDiscordTestMessageUseCase>(TYPES.SendDiscordTestMessageUseCase)
    .toDynamicValue(
      () =>
        new SendDiscordTestMessageUseCase(
          container.get<IDiscordWebhookRepository>(TYPES.IDiscordWebhookRepository),
        ),
    )
    .inTransientScope();

  container
    .bind<GetServerDiscordSettingsUseCase>(TYPES.GetServerDiscordSettingsUseCase)
    .toDynamicValue(
      () =>
        new GetServerDiscordSettingsUseCase(
          container.get<IServerDiscordSettingsRepository>(TYPES.IServerDiscordSettingsRepository),
        ),
    )
    .inTransientScope();

  container
    .bind<SaveServerDiscordSettingsUseCase>(TYPES.SaveServerDiscordSettingsUseCase)
    .toDynamicValue(
      () =>
        new SaveServerDiscordSettingsUseCase(
          container.get<IServerDiscordSettingsRepository>(TYPES.IServerDiscordSettingsRepository),
        ),
    )
    .inTransientScope();
}
