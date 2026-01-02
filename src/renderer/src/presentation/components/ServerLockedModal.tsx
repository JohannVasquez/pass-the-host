import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

interface ServerLockedModalProps {
  open: boolean;
  serverName: string | null;
  username: string;
  startedAt: string;
  onClose: () => void;
}

export function ServerLockedModal({
  open,
  username,
  startedAt,
  onClose,
}: ServerLockedModalProps): React.JSX.Element {
  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LockIcon color="error" />
        <Typography variant="h6">Server Locked</Typography>
      </DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 3 }}>
          This server is currently locked and cannot be started.
        </Alert>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PersonIcon color="primary" />
            <Typography variant="body1">
              <strong>Locked by:</strong> {username}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AccessTimeIcon color="primary" />
            <Typography variant="body1">
              <strong>Started at:</strong> {formatDate(startedAt)}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The server is currently running or was not properly stopped. Please wait for the other
            user to stop the server, or use the "Release Lock" option if you're sure the server is
            not running.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
