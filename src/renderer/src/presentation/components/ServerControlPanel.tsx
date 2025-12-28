import React from "react";
import { Box, Button, Stack, Paper, Typography, Chip, Alert } from "@mui/material";
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  LockOpen as LockOpenIcon,
  CloudSync as CloudSyncIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { ServerStatus } from "../../domain/entities/ServerStatus";

interface ServerControlPanelProps {
  status: ServerStatus;
  onStartStop: () => void;
  onReleaseLock: () => void;
  onSyncToR2: () => void;
  onEditProperties: () => void;
  disabled?: boolean;
}

export const ServerControlPanel: React.FC<ServerControlPanelProps> = ({
  status,
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
