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

  const handleChange = (field: keyof R2Config, value: string): void => {
    setLocalConfig({ ...localConfig, [field]: value });
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t("r2Configuration.title")}
      </Typography>
      <Stack spacing={2}>
        <TextField
          label={t("r2Configuration.accountId")}
          value={localConfig.accountId}
          onChange={(e) => handleChange("accountId", e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label={t("r2Configuration.accessKeyId")}
          value={localConfig.accessKeyId}
          onChange={(e) => handleChange("accessKeyId", e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label={t("r2Configuration.secretAccessKey")}
          type="password"
          value={localConfig.secretAccessKey}
          onChange={(e) => handleChange("secretAccessKey", e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label={t("r2Configuration.bucketName")}
          value={localConfig.bucketName}
          onChange={(e) => handleChange("bucketName", e.target.value)}
          fullWidth
          size="small"
        />
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={() => onSave(localConfig)}
          fullWidth
        >
          {t("r2Configuration.save")}
        </Button>
      </Stack>
    </Paper>
  );
};
