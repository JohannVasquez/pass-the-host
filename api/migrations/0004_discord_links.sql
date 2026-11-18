-- Discord bridge: one row per linked Discord server/channel. Only the sha256 of the link secret is stored.
-- guildId stays empty until the OAuth callback confirms the bot was added; channelId until a channel is picked.
-- CreateTable
CREATE TABLE "DiscordLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secretHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "state" TEXT,
    "stateExpiresAt" DATETIME,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "webhookId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLink_state_key" ON "DiscordLink"("state");
