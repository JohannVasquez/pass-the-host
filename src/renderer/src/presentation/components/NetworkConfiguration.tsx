import React from "react";
import {
  FormControl,
  IconButton,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { NetworkInterface } from "@renderer/domain/entities/ServerConfig";
import { monoFont, surface } from "@renderer/theme";

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
  const { enqueueSnackbar } = useSnackbar();

  // The exact text a friend on the same network pastes into Minecraft
  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(`${selectedIp}:${serverPort}`);
    enqueueSnackbar(t("network.addressCopied"), { variant: "success" });
  };

  const handlePortChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 65535) {
      onPortChange(value);
    }
  };

  return (
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
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            minHeight: 40,
            px: 1.5,
            border: 1,
            borderColor: surface.subtleBorder,
            borderRadius: 1,
            bgcolor: surface.panel,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {t("network.selectedIp")}:
          </Typography>
          <Typography
            variant="body2"
            sx={{ flexGrow: 1, fontFamily: monoFont, color: "primary.main" }}
          >
            {selectedIp}:{serverPort}
          </Typography>
          <Tooltip title={t("network.copyAddress")}>
            <IconButton size="small" onClick={handleCopy} aria-label={t("network.copyAddress")}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Stack>
  );
};
