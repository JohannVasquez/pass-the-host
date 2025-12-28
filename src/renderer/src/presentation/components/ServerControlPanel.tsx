import React from "react";
import { Box, Button, Stack, Paper, Typography, Chip } from "@mui/material";
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  LockOpen as LockOpenIcon,
  CloudSync as CloudSyncIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { ServerStatus } from "../../domain/entities/ServerStatus";

interface ServerControlPanelProps {
  status: ServerStatus;
  onStartStop: () => void;
  onReleaseLock: () => void;
  onSyncToR2: () => void;
  onEditProperties: () => void;
}

export const ServerControlPanel: React.FC<ServerControlPanelProps> = ({
  status,
  onStartStop,
  onReleaseLock,
  onSyncToR2,
  onEditProperties,
}): React.JSX.Element => {
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
        Control del Servidor
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Estado:
        </Typography>
        <Chip label={status} color={getStatusColor()} sx={{ textTransform: "capitalize" }} />
      </Box>

      <Stack spacing={1.5}>
        <Button
          variant="contained"
          color={isRunning ? "error" : "success"}
          startIcon={isRunning ? <StopIcon /> : <PlayIcon />}
          onClick={onStartStop}
          disabled={isTransitioning}
          fullWidth
        >
          {isRunning ? "Detener Servidor" : "Iniciar Servidor"}
        </Button>

        <Button variant="outlined" startIcon={<LockOpenIcon />} onClick={onReleaseLock} fullWidth>
          Liberar Lock
        </Button>

        <Button variant="outlined" startIcon={<CloudSyncIcon />} onClick={onSyncToR2} fullWidth>
          Sincronizar a R2
        </Button>

        <Button variant="outlined" startIcon={<EditIcon />} onClick={onEditProperties} fullWidth>
          Editar server.properties
        </Button>
      </Stack>
    </Paper>
  );
};
