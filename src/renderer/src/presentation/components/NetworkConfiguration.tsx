import React from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { NetworkInterface } from "../../domain/entities/ServerConfig";

interface NetworkConfigurationProps {
  availableIps: NetworkInterface[];
  selectedIp: string | null;
  serverPort: number;
  onSelectIp: (ip: string) => void;
  onPortChange: (port: number) => void;
  disabled?: boolean;
}

export const NetworkConfiguration: React.FC<NetworkConfigurationProps> = ({
  availableIps,
  selectedIp,
  serverPort,
  onSelectIp,
  onPortChange,
  disabled = false,
}): React.JSX.Element => {
  const { t } = useTranslation();

  const handlePortChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 65535) {
      onPortChange(value);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t("network.title")}
      </Typography>
      <Stack spacing={2}>
        <FormControl fullWidth size="small">
          <InputLabel>{t("network.selectIp")}</InputLabel>
          <Select
            value={selectedIp || ""}
            label={t("network.selectIp")}
            onChange={(e) => onSelectIp(e.target.value)}
            disabled={disabled}
          >
            {availableIps.map((iface) => (
              <MenuItem key={iface.ip} value={iface.ip}>
                {iface.name} - {iface.ip}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          size="small"
          type="number"
          label={t("network.port")}
          value={serverPort}
          onChange={handlePortChange}
          onWheel={(e) => {
            // Al hacer scroll, quitamos el foco del input
            (e.target as HTMLInputElement).blur();
          }}
          disabled={disabled}
          slotProps={{
            htmlInput: {
              min: 1,
              max: 65535,
            },
          }}
        />

        {selectedIp && (
          <Box sx={{ bgcolor: "action.hover", p: 1, pt: 0.5, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t("network.selectedIp")}:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {selectedIp}:{serverPort}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
