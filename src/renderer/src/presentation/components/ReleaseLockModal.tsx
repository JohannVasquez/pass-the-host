import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  AlertTitle,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useTranslation } from "react-i18next";

interface ReleaseLockModalProps {
  open: boolean;
  serverName: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ReleaseLockModal: React.FC<ReleaseLockModalProps> = ({
  open,
  serverName,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = React.useState("");
  const [error, setError] = React.useState(false);

  const handleConfirm = (): void => {
    if (inputValue === serverName) {
      onConfirm();
      handleClose();
    } else {
      setError(true);
    }
  };

  const handleClose = (): void => {
    setInputValue("");
    setError(false);
    onClose();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setInputValue(event.target.value);
    if (error) {
      setError(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="warning" />
          {t("releaseLockModal.title")}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          {/* Warning Alert */}
          <Alert severity="warning">
            <AlertTitle>{t("releaseLockModal.warningTitle")}</AlertTitle>
            {t("releaseLockModal.warningMessage")}
          </Alert>

          {/* Danger Alert */}
          <Alert severity="error">
            <AlertTitle>{t("releaseLockModal.dangerTitle")}</AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t("releaseLockModal.dangerMessage")}
            </Typography>
            <Typography variant="body2" component="ul" sx={{ pl: 2, m: 0 }}>
              <li>{t("releaseLockModal.consequence1")}</li>
              <li>{t("releaseLockModal.consequence2")}</li>
              <li>{t("releaseLockModal.consequence3")}</li>
            </Typography>
          </Alert>

          {/* Confirmation Input */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t("releaseLockModal.confirmationText")}{" "}
              <Typography component="span" sx={{ fontWeight: "bold", color: "warning.main" }}>
                {serverName}
              </Typography>
            </Typography>
            <TextField
              fullWidth
              value={inputValue}
              onChange={handleInputChange}
              placeholder={t("releaseLockModal.placeholder")}
              error={error}
              helperText={error ? t("releaseLockModal.error") : ""}
              autoFocus
              onKeyPress={(e): void => {
                if (e.key === "Enter") {
                  handleConfirm();
                }
              }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          {t("releaseLockModal.cancel")}
        </Button>
        <Button onClick={handleConfirm} variant="contained" color="error" disabled={!inputValue}>
          {t("releaseLockModal.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
