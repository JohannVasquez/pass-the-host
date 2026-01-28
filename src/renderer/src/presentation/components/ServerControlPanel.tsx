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
  FolderOpen as FolderOpenIcon,
  DeleteForever as DeleteForeverIcon,
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
  onOpenServerFolder: () => void;
  onDeleteServer: () => void;
  disabled?: boolean;
  serverStartTime: Date | null;
  username: string;
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
  onOpenServerFolder,
  onDeleteServer,
  disabled = false,
  serverStartTime,
  username,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const isRunning = status === ServerStatus.RUNNING;
  const isTransitioning = status === ServerStatus.STARTING || status === ServerStatus.STOPPING;
  const [uptime, setUptime] = React.useState<string>("00:00:00");

  // Update uptime every second when server is running
  React.useEffect(() => {
    if (!serverStartTime || !isRunning) {
      setUptime("00:00:00");
      return;
    }

    const updateUptime = (): void => {
      const now = new Date();
      const diff = now.getTime() - serverStartTime.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      setUptime(formatted);
    };

    updateUptime(); // Initial update
    const interval = setInterval(updateUptime, 1000);

    return () => clearInterval(interval);
  }, [serverStartTime, isRunning]);

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

      {!username && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("serverControl.usernameNotConfigured")}
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
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Chip
            label={t(`serverStatus.${status}`)}
            color={getStatusColor()}
            sx={{ textTransform: "capitalize" }}
          />
          {isRunning && (
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {uptime}
            </Typography>
          )}
        </Box>
      </Box>

      <Stack spacing={1.5}>
        <Button
          variant="contained"
          color={isRunning ? "error" : "success"}
          startIcon={isRunning ? <StopIcon /> : <PlayIcon />}
          onClick={onStartStop}
          disabled={disabled || isTransitioning || (!isRunning && !username)}
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
          variant="contained"
          color="warning" // Esto le da el color naranja
          startIcon={<FolderOpenIcon />}
          onClick={onOpenServerFolder}
          disabled={disabled || !selectedServer} // Desactivar si no hay server seleccionado
          fullWidth
        >
          {t("serverControl.openServerFolder")}
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

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteForeverIcon />}
          onClick={onDeleteServer}
          disabled={disabled || !selectedServer || isRunning || isTransitioning}
          fullWidth
        >
          {t("serverControl.deleteServer")}
        </Button>
      </Stack>
    </Paper>
  );
};
