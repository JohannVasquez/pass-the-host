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
import { monoFont, surface } from "@renderer/theme";

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          fontSize: 16,
          fontWeight: 600,
          py: 1.5,
        }}
      >
        <LockIcon color="error" />
        Server Locked
      </DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          This server is currently locked and cannot be started.
        </Alert>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "96px 1fr",
              rowGap: 0.75,
              fontSize: 13,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Locked by
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Started at
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: monoFont }}>
              {formatDate(startedAt)}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary">
            The server is currently running or was not properly stopped. Please wait for the other
            user to stop the server, or use the &quot;Release Lock&quot; option if you&apos;re sure
            the server is not running.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1, borderTop: `1px solid ${surface.border}` }}>
        <Button onClick={onClose} variant="contained" color="primary">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
