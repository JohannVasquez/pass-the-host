import React from "react";
import {
  Box,
  Button,
  Stack,
  Paper,
  Typography,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  LockOpen as LockOpenIcon,
  CloudSync as CloudSyncIcon,
  Edit as EditIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { ServerStatus } from "../../domain/entities/ServerStatus";
import { Server } from "../../domain/entities/Server";

interface ServerControlPanelProps {
  status: ServerStatus;
  selectedServer: string | null;
  servers: Server[];
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
  onStartStop: () => void;
  onReleaseLock: () => void;
  onSyncToR2: () => void;
  onEditProperties: () => void;
  disabled?: boolean;
}

export const ServerControlPanel: React.FC<ServerControlPanelProps> = ({
  status,
  selectedServer,
  servers,
  onSelectServer,
  onCreateServer,
  onStartStop,
  onReleaseLock,
  onSyncToR2,
  onEditProperties,
  disabled = false,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const isRunning = status === ServerStatus.RUNNING;
  const isTransitioning = status === ServerStatus.STARTING || status === ServerStatus.STOPPING;

  const getStatusColor = (): "success" | "error" | "warning" | "default" => {
    switch (status) {
      case ServerStatus.RUNNING:
        return "success";
      case ServerStatus.STOPPED:
        return "error";
      case ServerStatus.STARTING:
      case ServerStatus.STOPPING:
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t("serverControl.title")}
      </Typography>

      {disabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("serverControl.r2NotConfigured")}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>{t("serverControl.selectServer")}</InputLabel>
          <Select
            value={selectedServer || ""}
            label={t("serverControl.selectServer")}
            onChange={(e) => onSelectServer(e.target.value)}
            disabled={disabled || isRunning || isTransitioning}
          >
            {servers.map((server) => (
              <MenuItem key={server.id} value={server.id}>
                {server.name} - {server.type.toUpperCase()} ({server.version})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title={t("serverControl.createNewServer")}>
          <IconButton
            color="primary"
            onClick={onCreateServer}
            disabled={disabled || isRunning || isTransitioning}
            sx={{ flexShrink: 0 }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t("serverControl.status")}:
        </Typography>
        <Chip
          label={t(`serverStatus.${status}`)}
          color={getStatusColor()}
          sx={{ textTransform: "capitalize" }}
        />
      </Box>

      <Stack spacing={1.5}>
        <Button
          variant="contained"
          color={isRunning ? "error" : "success"}
          startIcon={isRunning ? <StopIcon /> : <PlayIcon />}
          onClick={onStartStop}
          disabled={disabled || isTransitioning}
          fullWidth
        >
          {isRunning ? t("serverControl.stop") : t("serverControl.start")}
        </Button>

        <Button
          variant="outlined"
          startIcon={<LockOpenIcon />}
          onClick={onReleaseLock}
          disabled={disabled}
          fullWidth
        >
          {t("serverControl.releaseLock")}
        </Button>

        <Button
          variant="outlined"
          startIcon={<CloudSyncIcon />}
          onClick={onSyncToR2}
          disabled={disabled}
          fullWidth
        >
          {t("serverControl.syncToR2")}
        </Button>

        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={onEditProperties}
          disabled={disabled}
          fullWidth
        >
          {t("serverControl.editProperties")}
        </Button>
      </Stack>
    </Paper>
  );
};
