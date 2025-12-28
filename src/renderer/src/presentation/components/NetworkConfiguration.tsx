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
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { NetworkInterface } from "../../domain/entities/ServerConfig";

interface NetworkConfigurationProps {
  availableIps: NetworkInterface[];
  selectedIp: string | null;
  onSelectIp: (ip: string) => void;
}

export const NetworkConfiguration: React.FC<NetworkConfigurationProps> = ({
  availableIps,
  selectedIp,
  onSelectIp,
}): React.JSX.Element => {
  const { t } = useTranslation();

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
          >
            {availableIps.map((iface) => (
              <MenuItem key={iface.ip} value={iface.ip}>
                {iface.name} - {iface.ip}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {selectedIp && (
          <Box sx={{ bgcolor: "action.hover", p: 1.5, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t("network.selectedIp")}:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {selectedIp}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
