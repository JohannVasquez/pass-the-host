import React from "react";
import {
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { monoFont } from "@renderer/theme";
import type { DiscordConfigData } from "@preload/index.d";

const DISCORD_HOSTS = ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"];

// Same rule as the main-process relay, which re-validates before sending.
const isValidWebhookUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      DISCORD_HOSTS.includes(url.hostname) &&
      /^\/api\/webhooks\/[^/]+\/[^/]+/.test(url.pathname)
    );
  } catch {
    return false;
  }
};

export const DiscordSettings: React.FC<{ serverId: string }> = ({ serverId }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [settings, setSettings] = React.useState<DiscordConfigData>({
    webhook_url: "",
    relay_chat: true,
    notify_status: true,
    notify_joins: false,
  });
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    window.discordAPI
      .getSettings(serverId)
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const url = settings.webhook_url.trim();
  const valid = isValidWebhookUrl(url);
  const showError = url !== "" && !valid;

  const save = async (next: DiscordConfigData): Promise<void> => {
    setSettings(next);
    try {
      await window.discordAPI.saveSettings(serverId, next);
    } catch {
      enqueueSnackbar(t("editServer.discord.saveFailed"), { variant: "error" });
    }
  };

  const saveUrl = (): void => {
    if (url === "" || valid) void save({ ...settings, webhook_url: url });
  };

  const sendTest = async (): Promise<void> => {
    setSending(true);
    try {
      const result = await window.discordAPI.sendTest(url);
      enqueueSnackbar(
        result.ok ? t("editServer.discord.testSent") : t("editServer.discord.testFailed"),
        { variant: result.ok ? "success" : "error" },
      );
    } catch {
      enqueueSnackbar(t("editServer.discord.testFailed"), { variant: "error" });
    } finally {
      setSending(false);
    }
  };

  const toggle = (
    key: "relay_chat" | "notify_status" | "notify_joins",
    label: string,
    hint: string,
  ): React.ReactNode => (
    <Stack>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={settings[key]}
            disabled={!valid}
            onChange={(e) => void save({ ...settings, [key]: e.target.checked })}
          />
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
      <Typography variant="caption" color="text.secondary" sx={{ ml: 5.5 }}>
        {hint}
      </Typography>
    </Stack>
  );

  return (
    <Stack spacing={1.5}>
      <TextField
        label={t("editServer.discord.webhookUrl")}
        placeholder="https://discord.com/api/webhooks/…"
        value={settings.webhook_url}
        onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
        onBlur={saveUrl}
        onKeyDown={(e) => e.key === "Enter" && saveUrl()}
        error={showError}
        helperText={showError ? t("editServer.discord.invalidUrl") : t("editServer.discord.webhookHelp")}
        size="small"
        fullWidth
        autoComplete="off"
        slotProps={{ htmlInput: { style: { fontFamily: monoFont } } }}
      />
      {toggle("relay_chat", t("editServer.discord.relayChat"), t("editServer.discord.relayChatHint"))}
      {toggle(
        "notify_status",
        t("editServer.discord.notifyStatus"),
        t("editServer.discord.notifyStatusHint"),
      )}
      {toggle(
        "notify_joins",
        t("editServer.discord.notifyJoins"),
        t("editServer.discord.notifyJoinsHint"),
      )}
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="outlined"
          onClick={() => void sendTest()}
          disabled={!valid || sending}
          startIcon={sending ? <CircularProgress size={16} /> : undefined}
        >
          {t("editServer.discord.sendTest")}
        </Button>
      </Stack>
    </Stack>
  );
};
