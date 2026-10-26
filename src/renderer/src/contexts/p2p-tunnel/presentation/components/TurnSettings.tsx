import React from "react";
import {
  Alert,
  Button,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import type { TurnConfig } from "@preload/index.d";

type TurnType = TurnConfig["type"];

export const TurnSettings: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [type, setType] = React.useState<TurnType>("cloudflare");
  const [keyId, setKeyId] = React.useState("");
  const [apiToken, setApiToken] = React.useState("");
  const [urls, setUrls] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [credential, setCredential] = React.useState("");
  const [isCustom, setIsCustom] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const config = await window.p2pAPI.getTurnConfig();
    setIsCustom(config !== null);
    if (config?.type === "cloudflare") {
      setType("cloudflare");
      setKeyId(config.keyId);
      setApiToken(config.apiToken);
    } else if (config) {
      setType("static");
      setUrls(config.urls.join("\n"));
      setUsername(config.username);
      setCredential(config.credential);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (config: TurnConfig | null): Promise<void> => {
    setBusy(true);
    try {
      await window.p2pAPI.saveTurnConfig(config);
      if (!config) {
        setKeyId("");
        setApiToken("");
        setUrls("");
        setUsername("");
        setCredential("");
      }
      await load();
      enqueueSnackbar(t("p2p.turn.saved"), { variant: "success" });
    } catch (error) {
      const code = String(error).includes("invalid_cloudflare_turn")
        ? "invalid_cloudflare_turn"
        : "invalid_turn_config";
      enqueueSnackbar(t(`p2p.errors.${code}`), { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const config: TurnConfig =
    type === "cloudflare"
      ? { type, keyId, apiToken }
      : { type, urls: urls.split(/[\s,]+/), username, credential };
  const canSave =
    type === "cloudflare"
      ? keyId.trim() !== "" && apiToken.trim() !== ""
      : urls.trim() !== "" && username.trim() !== "" && credential !== "";

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t("p2p.turn.description")}
      </Typography>
      <Alert severity={isCustom ? "success" : "info"}>
        {isCustom ? t("p2p.turn.usingCustom") : t("p2p.turn.notConfigured")}
      </Alert>
      <ToggleButtonGroup
        value={type}
        exclusive
        size="small"
        fullWidth
        onChange={(_e, value: TurnType | null) => value && setType(value)}
        disabled={busy}
      >
        <ToggleButton value="cloudflare">{t("p2p.turn.typeCloudflare")}</ToggleButton>
        <ToggleButton value="static">{t("p2p.turn.typeStatic")}</ToggleButton>
      </ToggleButtonGroup>
      {type === "cloudflare" ? (
        <>
          <Typography variant="caption" color="text.secondary">
            {t("p2p.turn.cloudflareHelp")}
          </Typography>
          <TextField
            label={t("p2p.turn.keyId")}
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            size="small"
            fullWidth
            disabled={busy}
          />
          <TextField
            label={t("p2p.turn.apiToken")}
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            size="small"
            fullWidth
            disabled={busy}
          />
        </>
      ) : (
        <>
          <TextField
            label={t("p2p.turn.urls")}
            helperText={t("p2p.turn.urlsHelp")}
            placeholder={"turn:turn.example.com:3478\nturns:turn.example.com:5349"}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            multiline
            minRows={2}
            size="small"
            fullWidth
            disabled={busy}
          />
          <TextField
            label={t("p2p.turn.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            size="small"
            fullWidth
            disabled={busy}
          />
          <TextField
            label={t("p2p.turn.credential")}
            type="password"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            size="small"
            fullWidth
            disabled={busy}
          />
        </>
      )}
      <Typography variant="caption" color="text.secondary">
        {t("p2p.turn.appliesNextConnection")}
      </Typography>
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={() => save(null)} disabled={busy || !isCustom}>
          {t("p2p.turn.remove")}
        </Button>
        <Button variant="contained" onClick={() => save(config)} disabled={busy || !canSave}>
          {t("p2p.turn.save")}
        </Button>
      </Stack>
    </Stack>
  );
};
