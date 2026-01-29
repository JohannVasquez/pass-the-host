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
import { useTranslation } from "react-i18next";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

interface ServerExistsModalProps {
  open: boolean;
  serverName: string;
  onCancel: () => void;
  onDelete: () => void;
  onOverwrite: () => void;
}

export const ServerExistsModal: React.FC<ServerExistsModalProps> = ({
  open,
  serverName,
  onCancel,
  onDelete,
  onOverwrite,
}): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="warning" />
          {t("serverExists.title")}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body1">{t("serverExists.message", { serverName })}</Typography>

          <Alert severity="warning">{t("serverExists.warning")}</Alert>

          <Typography variant="body2" color="text.secondary">
            {t("serverExists.options")}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel} color="inherit">
          {t("serverExists.cancel")}
        </Button>
        <Button onClick={onDelete} variant="outlined" color="error">
          {t("serverExists.delete")}
        </Button>
        <Button onClick={onOverwrite} variant="contained" color="warning">
          {t("serverExists.overwrite")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
