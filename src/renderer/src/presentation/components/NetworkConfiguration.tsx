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
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Configuración de Red
      </Typography>
      <Stack spacing={2}>
        <FormControl fullWidth size="small">
          <InputLabel>IP del Servidor</InputLabel>
          <Select
            value={selectedIp || ""}
            label="IP del Servidor"
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
              IP Seleccionada:
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
