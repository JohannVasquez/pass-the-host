import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import { useTranslation } from "react-i18next";
import type { S3Config } from "@renderer/domain/entities/ServerConfig";

interface ShareServerModalProps {
  open: boolean;
  /** Folder / cloud id of the server to share */
  serverName: string | null;
  displayName?: string | null;
  s3Config: S3Config;
  onClose: () => void;
}

export const ShareServerModal: React.FC<ShareServerModalProps> = ({
  open,
  serverName,
  displayName,
  s3Config,
  onClose,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = React.useState("");
  const [isSharing, setIsSharing] = React.useState(false);
  const [sharedWith, setSharedWith] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleShare = async (): Promise<void> => {
    if (!serverName || !email.trim()) return;

    setIsSharing(true);
    setError(null);
    setSharedWith(null);
    try {
      await window.rclone.shareDriveServer(s3Config, serverName, email.trim());
      setSharedWith(email.trim());
      setEmail("");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message.replace(/^Error invoking remote method '[^']+': /, ""));
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = (): void => {
    if (isSharing) return;
    setEmail("");
    setSharedWith(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("shareServer.title", { serverName: displayName ?? serverName })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("shareServer.description")}
        </Typography>
        <TextField
          autoFocus
          label={t("shareServer.emailLabel")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleShare();
          }}
          placeholder="amigo@gmail.com"
          fullWidth
          size="small"
          disabled={isSharing}
        />
        {sharedWith && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {t("shareServer.success", { email: sharedWith })}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t("shareServer.error")}
            <Typography variant="caption" component="div" sx={{ mt: 0.5, wordBreak: "break-word" }}>
              {error}
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSharing}>
          {t("shareServer.close")}
        </Button>
        <Button
          variant="contained"
          onClick={handleShare}
          disabled={isSharing || !email.trim()}
          startIcon={isSharing ? <CircularProgress size={16} /> : <ShareIcon />}
        >
          {t("shareServer.share")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
