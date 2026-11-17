import { Container } from "inversify";
import { TYPES } from "@main/contexts/discord-notifications/application/use-cases/types";
import {
  GetServerDiscordSettingsUseCase,
  SaveServerDiscordSettingsUseCase,
  SendDiscordTestMessageUseCase,
} from "@main/contexts/discord-notifications/application/use-cases";
import { DiscordIPCHandlers } from "./DiscordIPCHandlers";

export function registerDiscordIPCHandlers(container: Container): void {
  new DiscordIPCHandlers(
    container.get<SendDiscordTestMessageUseCase>(TYPES.SendDiscordTestMessageUseCase),
    container.get<GetServerDiscordSettingsUseCase>(TYPES.GetServerDiscordSettingsUseCase),
    container.get<SaveServerDiscordSettingsUseCase>(TYPES.SaveServerDiscordSettingsUseCase),
  ).register();
}
