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
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
} from "@mui/material";
import {
  Save as SaveIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { S3Config, S3Provider } from "../../domain/entities/ServerConfig";

interface S3ConfigurationProps {
  config: S3Config;
  onSave: (config: S3Config) => void;
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
};

// Provider-specific region placeholders
const PROVIDER_REGIONS: Record<S3Provider, string> = {
  AWS: "us-east-1",
  Cloudflare: "auto",
  MinIO: "us-east-1",
  Backblaze: "us-west-000",
  DigitalOcean: "nyc3",
  Other: "us-east-1",
};

export const S3Configuration: React.FC<S3ConfigurationProps> = ({
  config,
  onSave,
  disabled = false,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [localConfig, setLocalConfig] = React.useState<S3Config>(config);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [isLocked, setIsLocked] = React.useState<boolean>(false);
  const [isExpanded, setIsExpanded] = React.useState<boolean>(true);

  // Lock automatically when disabled from parent
  const effectivelyLocked = isLocked || disabled;

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
      setLocalConfig({
        ...localConfig,
        provider: newProvider,
        // Auto-fill endpoint and region placeholders when changing provider
        endpoint: localConfig.endpoint || PROVIDER_ENDPOINTS[newProvider],
        region: localConfig.region || PROVIDER_REGIONS[newProvider],
      });
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      const ok = await window.configAPI.saveS3Config(localConfig);
      setSaveStatus(ok ? "success" : "error");
      if (ok) onSave(localConfig);
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  return (
    <Accordion expanded={isExpanded} onChange={() => setIsExpanded(!isExpanded)} elevation={2}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t("s3Configuration.title")}
          </Typography>
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
          <FormControl fullWidth size="small" disabled={effectivelyLocked}>
            <InputLabel id="s3-provider-label">{t("s3Configuration.provider")}</InputLabel>
            <Select
              labelId="s3-provider-label"
              value={localConfig.provider}
              label={t("s3Configuration.provider")}
              onChange={handleProviderChange}
            >
              <MenuItem value="AWS">Amazon S3</MenuItem>
              <MenuItem value="Cloudflare">Cloudflare R2</MenuItem>
              <MenuItem value="MinIO">MinIO</MenuItem>
              <MenuItem value="Backblaze">Backblaze B2</MenuItem>
              <MenuItem value="DigitalOcean">DigitalOcean Spaces</MenuItem>
              <MenuItem value="Other">{t("s3Configuration.otherProvider")}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label={t("s3Configuration.endpoint")}
            value={localConfig.endpoint}
            onChange={(e) => handleChange("endpoint", e.target.value)}
            fullWidth
            size="small"
            disabled={effectivelyLocked}
            placeholder={PROVIDER_ENDPOINTS[localConfig.provider]}
          />
          <TextField
            label={t("s3Configuration.region")}
            value={localConfig.region}
            onChange={(e) => handleChange("region", e.target.value)}
            fullWidth
            size="small"
            disabled={effectivelyLocked}
            placeholder={PROVIDER_REGIONS[localConfig.provider]}
          />
          <TextField
            label={t("s3Configuration.access_key")}
            value={localConfig.access_key}
            onChange={(e) => handleChange("access_key", e.target.value)}
            fullWidth
            size="small"
            disabled={effectivelyLocked}
          />
          <TextField
            label={t("s3Configuration.secret_key")}
            type="password"
            value={localConfig.secret_key}
            onChange={(e) => handleChange("secret_key", e.target.value)}
            fullWidth
            size="small"
            disabled={effectivelyLocked}
          />
          <TextField
            label={t("s3Configuration.bucket_name")}
            value={localConfig.bucket_name}
            onChange={(e) => handleChange("bucket_name", e.target.value)}
            fullWidth
            size="small"
            disabled={effectivelyLocked}
          />
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
            disabled={effectivelyLocked}
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

/** @deprecated Use S3Configuration instead */
export const R2Configuration = S3Configuration;
