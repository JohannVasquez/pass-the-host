import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  ListSubheader,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@renderer/i18n/config";
import { isValidWebhookUrl } from "./discordWebhook";
import { monoFont } from "@renderer/theme";
import type { DiscordConfigData } from "@preload/index.d";

type DiscordChannel = Awaited<ReturnType<Window["discordAPI"]["listChannels"]>>[number];

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

type Phase = "none" | "pending" | "guild" | "channel";

interface DiscordSettingsProps {
  value: DiscordConfigData;
  onChange: (next: DiscordConfigData) => void;
  serverId: string;
  /** Server-side link changes (already saved): the parent must not treat them as unsaved edits */
  onLinkChange: (next: DiscordConfigData) => void;
}

export const DiscordSettings: React.FC<DiscordSettingsProps> = ({
  value,
  onChange,
  serverId,
  onLinkChange,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [sending, setSending] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>(
    !value.link_id ? "none" : value.channel_id ? "channel" : "pending",
  );
  const [guildName, setGuildName] = React.useState(value.guild_name ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [changing, setChanging] = React.useState(false);
  const [channels, setChannels] = React.useState<DiscordChannel[] | null>(null);
  const [channelId, setChannelId] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const errorText = (e: unknown): string => {
    const code = e instanceof Error ? e.message : String(e);
    if (code.includes("missing_permissions")) return t("editServer.discord.bot.errPermissions");
    if (code.includes("link_not_found") || code.includes("invalid_link"))
      return t("editServer.discord.bot.errExpired");
    return t("editServer.discord.bot.errGeneric", { code });
  };

  // Runs a link action and reports its failure inline
  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Waits for the browser authorization: poll every 2 s, give up after 5 minutes
  React.useEffect(() => {
    if (phase !== "pending") return;
    const started = Date.now();
    let stopped = false;
    const id = setInterval(() => {
      if (Date.now() - started > POLL_TIMEOUT_MS) {
        stopped = true;
        clearInterval(id);
        setPhase("none");
        setError(t("editServer.discord.bot.timedOut"));
        window.discordAPI.unlink(serverId).then(onLinkChange, () => {});
        return;
      }
      window.discordAPI
        .getLinkState(serverId)
        .then((st) => {
          if (stopped) return;
          if (st.status === "linked") {
            stopped = true;
            setGuildName(st.guildName ?? "");
            setPhase(st.channelId ? "channel" : "guild");
          } else if (st.status === "none") {
            stopped = true;
            setPhase("none");
            setError(t("editServer.discord.bot.errExpired"));
          }
        })
        .catch(() => {});
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, serverId]);

  const pickerOpen = phase === "guild" || (phase === "channel" && changing);
  React.useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setChannels(null);
    setChannelId("");
    window.discordAPI
      .listChannels(serverId)
      .then((list) => !cancelled && setChannels(list))
      .catch((e) => {
        if (cancelled) return;
        setChannels([]);
        setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen, serverId]);

  const connect = (): Promise<void> =>
    run(async () => {
      const st = await window.discordAPI.startLink(serverId);
      setPhase(st.status === "linked" ? (st.channelId ? "channel" : "guild") : "pending");
      setGuildName(st.guildName ?? "");
    });

  const unlink = (): Promise<void> =>
    run(async () => {
      onLinkChange(await window.discordAPI.unlink(serverId));
      setPhase("none");
      setChanging(false);
      setConfirmOpen(false);
    });

  const confirmChannel = (): Promise<void> =>
    run(async () => {
      onLinkChange(await window.discordAPI.selectChannel(serverId, channelId));
      setPhase("channel");
      setChanging(false);
    });

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

  const webhookField = (
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
  );

  // Text channels grouped under their category
  const categories = Array.from(
    new Set((channels ?? []).map((c) => c.category ?? "")),
  ).sort((x, y) => (x === "" ? 1 : y === "" ? -1 : 0));
  const channelItems = categories.flatMap((cat) => [
    <ListSubheader key={`cat-${cat}`}>{cat || t("editServer.discord.bot.noCategory")}</ListSubheader>,
    ...(channels ?? [])
      .filter((c) => (c.category ?? "") === cat)
      .map((c) => (
        <MenuItem key={c.id} value={c.id}>
          #{c.name}
        </MenuItem>
      )),
  ]);

  const picker = (
    <Stack spacing={1}>
      <TextField
        select
        size="small"
        label={t("editServer.discord.bot.pickChannel")}
        value={channelId}
        onChange={(e) => setChannelId(e.target.value)}
        disabled={busy || channels === null}
        helperText={channels?.length === 0 ? t("editServer.discord.bot.noChannels") : undefined}
        slotProps={{
          input: { endAdornment: channels === null ? <CircularProgress size={16} sx={{ mr: 3 }} /> : undefined },
        }}
      >
        {channelItems}
      </TextField>
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {changing && (
          <Button onClick={() => setChanging(false)} disabled={busy}>
            {t("editServer.discord.bot.cancel")}
          </Button>
        )}
        <Button variant="contained" onClick={() => void confirmChannel()} disabled={busy || !channelId}>
          {t("editServer.discord.bot.confirm")}
        </Button>
      </Stack>
    </Stack>
  );

  const showOptions = phase === "channel" || (phase === "none" && valid);

  return (
    <Stack spacing={1.5}>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {phase === "none" && (
        <>
          <Typography variant="body2" color="text.secondary">
            {t("editServer.discord.bot.connectHint")}
          </Typography>
          <Stack direction="row">
            <Button
              variant="contained"
              onClick={() => void connect()}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={16} /> : undefined}
            >
              {t("editServer.discord.bot.connect")}
            </Button>
          </Stack>
          <Accordion disableGutters variant="outlined" defaultExpanded={url !== ""}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">{t("editServer.discord.bot.advanced")}</Typography>
            </AccordionSummary>
            <AccordionDetails>{webhookField}</AccordionDetails>
          </Accordion>
        </>
      )}
      {phase === "pending" && (
        <Stack direction="row" spacing={1.5} alignItems="center" role="status">
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {t("editServer.discord.bot.pending")}
          </Typography>
          <Button onClick={() => void unlink()} disabled={busy}>
            {t("editServer.discord.bot.cancel")}
          </Button>
        </Stack>
      )}
      {(phase === "guild" || phase === "channel") && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" sx={{ flex: 1 }}>
            {phase === "channel"
              ? t("editServer.discord.bot.summary", {
                  guild: value.guild_name || guildName,
                  channel: value.channel_name,
                })
              : `${t("editServer.discord.bot.server")}: ${guildName || value.guild_name || ""}`}
          </Typography>
          {phase === "channel" && !changing && (
            <Button size="small" onClick={() => setChanging(true)} disabled={busy}>
              {t("editServer.discord.bot.changeChannel")}
            </Button>
          )}
        </Stack>
      )}
      {pickerOpen && picker}
      {phase === "channel" && (
        <Stack>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={!!value.relay_to_game}
                onChange={(e) => onChange({ ...value, relay_to_game: e.target.checked })}
              />
            }
            label={<Typography variant="body2">{t("editServer.discord.bot.relayToGame")}</Typography>}
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 5.5 }}>
            {t("editServer.discord.bot.relayToGameHint")}
          </Typography>
        </Stack>
      )}
      {showOptions && (
        <>
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
        </>
      )}
      {(phase === "guild" || phase === "channel") && (
        <Stack direction="row" justifyContent="flex-end">
          <Button color="error" onClick={() => setConfirmOpen(true)} disabled={busy}>
            {t("editServer.discord.bot.disconnect")}
          </Button>
        </Stack>
      )}
      <Dialog open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)}>
        <DialogTitle>{t("editServer.discord.bot.disconnectTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("editServer.discord.bot.disconnectBody")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={busy}>
            {t("editServer.discord.bot.cancel")}
          </Button>
          <Button color="error" onClick={() => void unlink()} disabled={busy}>
            {t("editServer.discord.bot.disconnect")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
