import React from "react";
import { TextField, Button, Typography, Stack, Paper } from "@mui/material";
import { Save as SaveIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { R2Config } from "../../domain/entities/ServerConfig";

interface R2ConfigurationProps {
  config: R2Config;
  onSave: (config: R2Config) => void;
}

export const R2Configuration: React.FC<R2ConfigurationProps> = ({
  config,
  onSave,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [localConfig, setLocalConfig] = React.useState<R2Config>(config);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "success" | "error">("idle");

  const handleChange = (field: keyof R2Config, value: string): void => {
    setLocalConfig({ ...localConfig, [field]: value });
  };

  const handleSave = async () => {
    try {
      // @ts-ignore
      const ok = await window.configAPI.saveR2Config(localConfig);
      setSaveStatus(ok ? "success" : "error");
      if (ok) onSave(localConfig);
    } catch {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t("r2Configuration.title")}
      </Typography>
      <Stack spacing={2}>
        <TextField
          label={t("r2Configuration.endpoint")}
          value={localConfig.endpoint}
          onChange={(e) => handleChange("endpoint", e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label={t("r2Configuration.access_key")}
          value={localConfig.access_key}
          onChange={(e) => handleChange("access_key", e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label={t("r2Configuration.secret_key")}
          type="password"
          value={localConfig.secret_key}
          onChange={(e) => handleChange("secret_key", e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label={t("r2Configuration.bucket_name")}
          value={localConfig.bucket_name}
          onChange={(e) => handleChange("bucket_name", e.target.value)}
          fullWidth
          size="small"
        />
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} fullWidth>
          {t("r2Configuration.save")}
        </Button>
        {saveStatus === "success" && (
          <Typography color="success.main" variant="body2">
            {t("r2Configuration.save") + " OK"}
          </Typography>
        )}
        {saveStatus === "error" && (
          <Typography color="error.main" variant="body2">
            {t("r2Configuration.save") + " ERROR"}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};
