import { Container } from "inversify";
import { TYPES } from "@main/contexts/discord-notifications/application/use-cases/types";
import {
  IDiscordWebhookRepository,
  IServerDiscordSettingsRepository,
} from "@main/contexts/discord-notifications/domain/repositories";
import {
  DiscordWebhookRepository,
  ServerDiscordSettingsRepository,
} from "@main/contexts/discord-notifications/infrastructure/repositories";
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
    .bind<RelayServerOutputUseCase>(TYPES.RelayServerOutputUseCase)
    .toDynamicValue(() => {
      const settings = container.get<IServerDiscordSettingsRepository>(
        TYPES.IServerDiscordSettingsRepository,
      );
      return new RelayServerOutputUseCase(
        container.get<IDiscordWebhookRepository>(TYPES.IDiscordWebhookRepository),
        (serverId) => settings.get(serverId),
        (serverId) => settings.serverName(serverId),
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
