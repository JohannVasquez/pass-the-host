import React from "react";
import {
  TextField,
  Button,
  Typography,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  type SelectChangeEvent,
} from "@mui/material";
import {
  Save as SaveIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ExpandMore as ExpandMoreIcon,
  Google as GoogleIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import { PanelTitle } from "@renderer/presentation/components/PanelTitle";
import {
  PROVIDER_LABELS,
  S3Config,
  S3Provider,
  toStorageProfile,
} from "@renderer/domain/entities/ServerConfig";

interface S3ConfigurationProps {
  config: S3Config;
  onSave: (config: S3Config) => void;
  cloudSyncEnabled: boolean;
  onToggleCloudSync: (enabled: boolean) => void;
  disabled?: boolean;
}

// Provider-specific endpoint placeholders
const PROVIDER_ENDPOINTS: Record<S3Provider, string> = {
  AWS: "https://s3.us-east-1.amazonaws.com",
  Cloudflare: "https://<account-id>.r2.cloudflarestorage.com",
  MinIO: "http://localhost:9000",
  Backblaze: "https://s3.us-west-000.backblazeb2.com",
  DigitalOcean: "https://<region>.digitaloceanspaces.com",
  Other: "https://s3.example.com",
  GoogleDrive: "",
};

// Provider-specific region placeholders
const PROVIDER_REGIONS: Record<S3Provider, string> = {
  AWS: "us-east-1",
  Cloudflare: "auto",
  MinIO: "us-east-1",
  Backblaze: "us-west-000",
  DigitalOcean: "nyc3",
  Other: "us-east-1",
  GoogleDrive: "",
};

export const S3Configuration: React.FC<S3ConfigurationProps> = ({
  config,
  onSave,
  cloudSyncEnabled,
  onToggleCloudSync,
  disabled = false,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [localConfig, setLocalConfig] = React.useState<S3Config>(config);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [isLocked, setIsLocked] = React.useState<boolean>(false);
  const [isExpanded, setIsExpanded] = React.useState<boolean>(true);
  const [driveStatus, setDriveStatus] = React.useState<"idle" | "connecting" | "error">("idle");
  const driveSignInCancelled = React.useRef(false);
  const isDrive = localConfig.provider === "GoogleDrive";

  // Lock automatically when disabled from parent
  const effectivelyLocked = isLocked || disabled;
  const storageFieldsDisabled = effectivelyLocked || !cloudSyncEnabled;

  // Update localConfig when config prop changes
  React.useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (field: keyof S3Config, value: string): void => {
    if (!effectivelyLocked) {
      setLocalConfig({ ...localConfig, [field]: value });
    }
  };

  const handleProviderChange = (event: SelectChangeEvent<S3Provider>): void => {
    if (!effectivelyLocked) {
      const newProvider = event.target.value as S3Provider;
      // Load what was saved for that provider; never carry over another provider's settings.
      const saved = localConfig.profiles?.[newProvider] ?? {};
      setLocalConfig({
        ...localConfig,
        provider: newProvider,
        endpoint: saved.endpoint ?? "",
        region: saved.region || PROVIDER_REGIONS[newProvider],
        access_key: saved.access_key ?? "",
        secret_key: saved.secret_key ?? "",
        bucket_name: saved.bucket_name ?? "",
        drive_token: saved.drive_token,
      });
    }
  };

  const saveConfig = async (configToSave: S3Config): Promise<void> => {
    try {
      const ok = await window.configAPI.saveS3Config(configToSave);
      setSaveStatus(ok ? "success" : "error");
      // Mirror the profile main just stored, so switching back before a reload shows it.
      if (ok) {
        onSave({
          ...configToSave,
          profiles: {
            ...configToSave.profiles,
            [configToSave.provider]: toStorageProfile(configToSave),
          },
        });
      }
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handleSave = (): Promise<void> => saveConfig(localConfig);

  const handleConnectDrive = async (): Promise<void> => {
    driveSignInCancelled.current = false;
    setDriveStatus("connecting");
    try {
      const driveToken = await window.rclone.authorizeDrive();
      const connectedConfig = { ...localConfig, drive_token: driveToken };
      setLocalConfig(connectedConfig);
      setDriveStatus("idle");
      await saveConfig(connectedConfig);
    } catch {
      setDriveStatus(driveSignInCancelled.current ? "idle" : "error");
    }
  };

  const handleCancelDrive = async (): Promise<void> => {
    driveSignInCancelled.current = true;
    setDriveStatus("idle");
    await window.rclone.cancelAuthorizeDrive();
  };

  return (
    <Accordion expanded={isExpanded} onChange={() => setIsExpanded(!isExpanded)} elevation={2}>
      {/* div, not the default button: it contains the lock IconButton, and HTML forbids nested buttons. */}
      <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
          <PanelTitle icon={<CloudOutlinedIcon />} sx={{ flexGrow: 1 }}>
            {t("s3Configuration.title")}
          </PanelTitle>
          <Tooltip
            title={effectivelyLocked ? t("s3Configuration.unlock") : t("s3Configuration.lock")}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setIsLocked(!isLocked);
              }}
              color={effectivelyLocked ? "error" : "default"}
              disabled={disabled}
            >
              {effectivelyLocked ? <LockIcon /> : <LockOpenIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={cloudSyncEnabled}
                onChange={(_event, checked) => onToggleCloudSync(checked)}
                disabled={disabled}
              />
            }
            label={t("s3Configuration.enableSync")}
          />
          <FormControl fullWidth size="small" disabled={storageFieldsDisabled}>
            <InputLabel id="s3-provider-label">{t("s3Configuration.provider")}</InputLabel>
            <Select
              labelId="s3-provider-label"
              value={localConfig.provider}
              label={t("s3Configuration.provider")}
              onChange={handleProviderChange}
            >
              {(Object.keys(PROVIDER_LABELS) as S3Provider[]).map((provider) => (
                <MenuItem key={provider} value={provider}>
                  {provider === "Other"
                    ? t("s3Configuration.otherProvider")
                    : PROVIDER_LABELS[provider]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {isDrive ? (
            <Stack spacing={1}>
              <Typography
                variant="body2"
                color={localConfig.drive_token ? "success.main" : "text.secondary"}
              >
                {localConfig.drive_token
                  ? t("s3Configuration.driveConnected")
                  : t("s3Configuration.driveNotConnected")}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<GoogleIcon />}
                onClick={handleConnectDrive}
                fullWidth
                disabled={storageFieldsDisabled || driveStatus === "connecting"}
              >
                {driveStatus === "connecting"
                  ? t("s3Configuration.driveConnecting")
                  : localConfig.drive_token
                    ? t("s3Configuration.driveReconnect")
                    : t("s3Configuration.driveConnect")}
              </Button>
              {driveStatus === "connecting" && (
                <Button variant="text" color="inherit" onClick={handleCancelDrive} fullWidth>
                  {t("s3Configuration.driveCancel")}
                </Button>
              )}
              {driveStatus === "error" && (
                <Typography color="error.main" variant="body2">
                  {t("s3Configuration.driveError")}
                </Typography>
              )}
            </Stack>
          ) : (
            <>
              <TextField
                label={t("s3Configuration.endpoint")}
                value={localConfig.endpoint}
                onChange={(e) => handleChange("endpoint", e.target.value)}
                fullWidth
                size="small"
                disabled={storageFieldsDisabled}
                placeholder={PROVIDER_ENDPOINTS[localConfig.provider]}
              />
              <TextField
                label={t("s3Configuration.region")}
                value={localConfig.region}
                onChange={(e) => handleChange("region", e.target.value)}
                fullWidth
                size="small"
                disabled={storageFieldsDisabled}
                placeholder={PROVIDER_REGIONS[localConfig.provider]}
              />
              <TextField
                label={t("s3Configuration.access_key")}
                value={localConfig.access_key}
                onChange={(e) => handleChange("access_key", e.target.value)}
                fullWidth
                size="small"
                disabled={storageFieldsDisabled}
              />
              <TextField
                label={t("s3Configuration.secret_key")}
                type="password"
                value={localConfig.secret_key}
                onChange={(e) => handleChange("secret_key", e.target.value)}
                fullWidth
                size="small"
                disabled={storageFieldsDisabled}
              />
              <TextField
                label={t("s3Configuration.bucket_name")}
                value={localConfig.bucket_name}
                onChange={(e) => handleChange("bucket_name", e.target.value)}
                fullWidth
                size="small"
                disabled={storageFieldsDisabled}
              />
            </>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
            disabled={storageFieldsDisabled}
          >
            {t("s3Configuration.save")}
          </Button>
          {saveStatus === "success" && (
            <Typography color="success.main" variant="body2">
              {t("s3Configuration.saveSuccess")}
            </Typography>
          )}
          {saveStatus === "error" && (
            <Typography color="error.main" variant="body2">
              {t("s3Configuration.saveError")}
            </Typography>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
