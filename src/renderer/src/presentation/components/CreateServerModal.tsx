import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  RadioGroup,
  Radio,
  FormLabel,
  Chip,
  Skeleton,
  Switch,
  FormControlLabel,
  CircularProgress,
  Typography,
  LinearProgress,
} from "@mui/material";
import AddBoxIcon from "@mui/icons-material/AddBox";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Trans, useTranslation } from "react-i18next";
import { monoFont, surface } from "../../theme";

interface CreateServerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    serverName: string,
    version: string,
    serverType: EngineType,
    engineVersion?: string,
  ) => void;
  isCreating?: boolean;
  progressMessage?: string;
}

type EngineType = "vanilla" | "paper" | "fabric" | "quilt" | "forge" | "neoforge";
type EngineVersion = { id: string; label: string; beta?: boolean };

const engines: { id: EngineType; name: string; mono: string }[] = [
  { id: "vanilla", name: "Vanilla", mono: "V" },
  { id: "paper", name: "Paper", mono: "P" },
  { id: "fabric", name: "Fabric", mono: "F" },
  { id: "quilt", name: "Quilt", mono: "Q" },
  { id: "forge", name: "Forge", mono: "Fo" },
  { id: "neoforge", name: "NeoForge", mono: "N" },
];

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  open,
  onClose,
  onConfirm,
  isCreating = false,
  progressMessage = "",
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [serverName, setServerName] = React.useState<string>("");
  const [version, setVersion] = React.useState<string>("");
  const [serverType, setServerType] = React.useState<EngineType>("vanilla");
  const [engineVersion, setEngineVersion] = React.useState<string>("");
  const [showBeta, setShowBeta] = React.useState<boolean>(false);
  const [nameError, setNameError] = React.useState<string>("");
  const [games, setGames] = React.useState<{ engine: EngineType | null; list: string[] }>({
    engine: null,
    list: [],
  });
  const [engineData, setEngineData] = React.useState<{
    key: string;
    versions: EngineVersion[];
    recommended: string | null;
  }>({ key: "", versions: [], recommended: null });
  const [java, setJava] = React.useState<number | null>(null);
  const [error, setError] = React.useState<boolean>(false);
  const [retry, setRetry] = React.useState<number>(0);

  const isVanilla = serverType === "vanilla";
  const engineName = engines.find((e) => e.id === serverType)?.name ?? "";
  const loading =
    !error &&
    (games.engine !== serverType || (!isVanilla && engineData.key !== `${serverType}|${version}`));
  const visibleVersions = showBeta
    ? engineData.versions
    : engineData.versions.filter((v) => !v.beta || v.id === engineData.recommended);

  // Minecraft versions for the engine; keep the selection when the new engine supports it
  React.useEffect(() => {
    if (!open) return;
    let stale = false;
    setError(false);
    window.serverAPI
      .listGameVersions(serverType)
      .then((list) => {
        if (stale) return;
        setGames({ engine: serverType, list });
        setVersion((prev) => (list.includes(prev) ? prev : (list[0] ?? "")));
      })
      .catch(() => !stale && setError(true));
    return () => {
      stale = true;
    };
  }, [open, serverType, retry]);

  // Engine versions for the engine + Minecraft pair; default to the recommended one
  React.useEffect(() => {
    if (!open || isVanilla || games.engine !== serverType || !games.list.includes(version)) return;
    let stale = false;
    window.serverAPI
      .listEngineVersions(serverType, version)
      .then((res) => {
        if (stale) return;
        setEngineData({ key: `${serverType}|${version}`, ...res });
        setEngineVersion(
          res.recommended ?? res.versions.find((v) => !v.beta)?.id ?? res.versions[0]?.id ?? "",
        );
      })
      .catch(() => !stale && setError(true));
    return () => {
      stale = true;
    };
  }, [open, serverType, version, games, isVanilla, retry]);

  React.useEffect(() => {
    if (!open || !version) return;
    let stale = false;
    setJava(null);
    window.javaAPI
      .getRequiredVersion(version)
      .then((n) => !stale && setJava(n))
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [open, version]);

  const versionLabel = (v: EngineVersion): React.JSX.Element => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <span style={{ fontFamily: monoFont }}>{v.label}</span>
      {v.id === engineData.recommended && (
        <Chip
          label={t("createServer.recommended")}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ height: 18, fontSize: 11 }}
        />
      )}
      {v.beta && (
        <Chip
          label={t("createServer.beta")}
          size="small"
          color="warning"
          variant="outlined"
          sx={{ height: 18, fontSize: 11 }}
        />
      )}
    </Box>
  );

  const handleToggleBeta = (_: unknown, checked: boolean): void => {
    setShowBeta(checked);
    const cur = engineData.versions.find((v) => v.id === engineVersion);
    if (!checked && cur?.beta && cur.id !== engineData.recommended) {
      setEngineVersion(engineData.recommended ?? "");
    }
  };

  // If creating, show progress view
  if (isCreating) {
    return (
      <Dialog open={open} disableEscapeKeyDown maxWidth="sm" fullWidth>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 4,
              gap: 3,
            }}
          >
            <CircularProgress size={60} thickness={4} />
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              {t("createServer.creatingTitle")}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                textAlign: "center",
                minHeight: "24px",
              }}
            >
              {progressMessage || t("createServer.preparing")}
            </Typography>
            <Box sx={{ width: "100%", mt: 2 }}>
              <LinearProgress />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                textAlign: "center",
                mt: 1,
              }}
            >
              {t("createServer.modalWarning")}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  const handleServerNameChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;

    // Any characters: the folder / cloud id is derived from it with toServerId
    if (value.trim().length > 0 && value.trim().length < 3) {
      setNameError(t("createServer.nameTooShort"));
    } else {
      setNameError("");
    }

    setServerName(value);
  };

  const handleConfirm = (): void => {
    if (serverName.trim() === "") {
      setNameError(t("createServer.nameRequired"));
      return;
    }

    if (serverName.trim().length < 3) {
      setNameError(t("createServer.nameTooShort"));
      return;
    }

    if (nameError) {
      return;
    }

    onConfirm(
      serverName.trim(),
      version,
      serverType,
      serverType === "vanilla" ? undefined : engineVersion,
    );
    handleClose();
  };

  const handleClose = (): void => {
    setServerName("");
    setVersion("");
    setEngineVersion("");
    setShowBeta(false);
    setError(false);
    setServerType("vanilla");
    setNameError("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, fontWeight: 600 }}>
        <AddBoxIcon color="primary" fontSize="small" />
        {t("createServer.title")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 2 }}>
          {/* Server Name */}
          <TextField
            label={t("createServer.serverName")}
            value={serverName}
            onChange={handleServerNameChange}
            error={!!nameError}
            helperText={nameError || t("createServer.nameHelp")}
            fullWidth
            autoFocus
            slotProps={{ htmlInput: { maxLength: 50 } }}
          />

          {/* Engine */}
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 1, fontSize: 13 }}>
              {t("createServer.engine")}
            </FormLabel>
            <RadioGroup
              value={serverType}
              onChange={(e) => setServerType(e.target.value as EngineType)}
              sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}
            >
              {engines.map((e) => (
                <Box
                  key={e.id}
                  component="label"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1.25,
                    minWidth: 0,
                    cursor: "pointer",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: serverType === e.id ? "primary.main" : surface.border,
                    bgcolor: serverType === e.id ? "rgba(45,212,191,.08)" : surface.input,
                    "&:hover": {
                      borderColor: serverType === e.id ? "primary.main" : "text.secondary",
                    },
                    "&:has(input:focus-visible)": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 1,
                      fontSize: 12,
                      fontWeight: 700,
                      bgcolor: serverType === e.id ? "primary.main" : surface.raised,
                      color: serverType === e.id ? "primary.contrastText" : "text.secondary",
                    }}
                  >
                    {e.mono}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                      {e.name}
                    </Typography>
                    <Typography noWrap color="text.secondary" sx={{ fontSize: 12 }}>
                      {t(`createServer.engineDesc.${e.id}`)}
                    </Typography>
                  </Box>
                  <Radio value={e.id} size="small" sx={{ p: 0 }} />
                </Box>
              ))}
            </RadioGroup>
          </FormControl>

          {error && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => setRetry((n) => n + 1)}>
                  {t("createServer.retry")}
                </Button>
              }
            >
              {t("createServer.loadError")}
            </Alert>
          )}

          {/* Versions */}
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t("createServer.minecraft")}</InputLabel>
              {loading ? (
                <Skeleton variant="rounded" height={40} />
              ) : (
                <Select
                  value={games.list.includes(version) ? version : ""}
                  label={t("createServer.minecraft")}
                  onChange={(e) => setVersion(e.target.value)}
                  MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320 } } } }}
                >
                  {games.list.map((v) => (
                    <MenuItem key={v} value={v}>
                      {v}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </FormControl>
            {!isVanilla && (
              <FormControl fullWidth size="small">
                <InputLabel>{t("createServer.engineVersion", { engine: engineName })}</InputLabel>
                {loading ? (
                  <Skeleton variant="rounded" height={40} />
                ) : (
                  <Select
                    value={visibleVersions.some((v) => v.id === engineVersion) ? engineVersion : ""}
                    label={t("createServer.engineVersion", { engine: engineName })}
                    onChange={(e) => setEngineVersion(e.target.value)}
                    renderValue={(id) => {
                      const v = visibleVersions.find((x) => x.id === id);
                      return v ? versionLabel(v) : id;
                    }}
                    MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320 } } } }}
                  >
                    {visibleVersions.map((v) => (
                      <MenuItem key={v.id} value={v.id}>
                        {versionLabel(v)}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              </FormControl>
            )}
          </Box>

          {!isVanilla && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                mt: -1,
              }}
            >
              <FormControlLabel
                control={<Switch size="small" checked={showBeta} onChange={handleToggleBeta} />}
                label={<Typography sx={{ fontSize: 13 }}>{t("createServer.showBeta")}</Typography>}
              />
              {loading && !error && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <LinearProgress sx={{ width: 110, height: 3, borderRadius: 2 }} />
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    {t("createServer.loadingVersions")}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Summary */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 1.5,
              minHeight: 44,
              borderRadius: 1,
              border: `1px solid ${surface.subtleBorder}`,
              bgcolor: surface.console,
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            {loading || error || !version ? (
              <Skeleton variant="rounded" width={220} height={12} />
            ) : (
              <Typography sx={{ fontSize: 13 }}>
                <Trans
                  i18nKey={
                    isVanilla ? "createServer.willInstallVanilla" : "createServer.willInstall"
                  }
                  values={{
                    engine: t(`createServer.engineSummary.${serverType}`, {
                      v:
                        engineData.versions.find((v) => v.id === engineVersion)?.label ??
                        engineVersion,
                    }),
                    mc: version,
                  }}
                  components={{ b: <b /> }}
                />
                {java !== null && ` · Java ${java}`}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          {t("createServer.cancel")}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={
            !!nameError ||
            serverName.trim() === "" ||
            loading ||
            error ||
            !version ||
            (!isVanilla && !engineVersion)
          }
        >
          {t("createServer.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
