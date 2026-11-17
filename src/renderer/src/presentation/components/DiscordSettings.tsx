import React from "react";
import {
  Button,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@renderer/i18n/config";
import { isValidWebhookUrl } from "./discordWebhook";
import { monoFont } from "@renderer/theme";
import type { DiscordConfigData } from "@preload/index.d";

interface DiscordSettingsProps {
  value: DiscordConfigData;
  onChange: (next: DiscordConfigData) => void;
}

export const DiscordSettings: React.FC<DiscordSettingsProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [sending, setSending] = React.useState(false);

  const url = value.webhook_url.trim();
  const valid = isValidWebhookUrl(url);
  const showError = url !== "" && !valid;

  const sendTest = async (): Promise<void> => {
    setSending(true);
    try {
      const result = await window.discordAPI.sendTest(url, value.language);
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
            checked={value[key]}
            disabled={!valid}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
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
        value={value.webhook_url}
        onChange={(e) => onChange({ ...value, webhook_url: e.target.value })}
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
      <TextField
        select
        size="small"
        label={t("editServer.discord.language")}
        helperText={t("editServer.discord.languageHint")}
        value={value.language ?? "en"}
        disabled={!valid}
        onChange={(e) => onChange({ ...value, language: e.target.value })}
      >
        {LANGUAGES.map((l) => (
          <MenuItem key={l.code} value={l.code}>
            {l.name}
          </MenuItem>
        ))}
      </TextField>
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
