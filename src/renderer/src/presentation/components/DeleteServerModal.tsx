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
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { useTranslation } from "react-i18next";

interface DeleteServerModalProps {
  open: boolean;
  serverName: string | null;
  onClose: () => void;
  onConfirm: (deleteLocally: boolean) => Promise<void>;
}

export const DeleteServerModal: React.FC<DeleteServerModalProps> = ({
  open,
  serverName,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = React.useState("");
  const [error, setError] = React.useState(false);
  const [deleteLocally, setDeleteLocally] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async (): Promise<void> => {
    if (inputValue === serverName) {
      setIsDeleting(true);
      try {
        await onConfirm(deleteLocally);
        handleClose();
      } catch (e) {
        console.error("Error deleting server:", e);
      } finally {
        setIsDeleting(false);
      }
    } else {
      setError(true);
    }
  };

  const handleClose = (): void => {
    if (isDeleting) return; // Don't allow closing while deleting
    setInputValue("");
    setError(false);
    setDeleteLocally(false);
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
          <DeleteForeverIcon color="error" />
          {t("deleteServerModal.title")}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          {/* Warning Alert */}
          <Alert severity="error">
            <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
              {t("deleteServerModal.warning")}
            </Typography>
            <Typography variant="body2">
              {deleteLocally
                ? t("deleteServerModal.alsoLocal")
                : t("deleteServerModal.cloudOnly")}
            </Typography>
          </Alert>

          {/* Delete locally checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={deleteLocally}
                onChange={(e) => setDeleteLocally(e.target.checked)}
                color="error"
                disabled={isDeleting}
              />
            }
            label={t("deleteServerModal.deleteLocalFiles")}
          />

          {/* Confirmation Input */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t("deleteServerModal.confirmationText")}{" "}
              <Typography component="span" sx={{ fontWeight: "bold", color: "error.main" }}>
                {serverName}
              </Typography>
            </Typography>
            <TextField
              fullWidth
              value={inputValue}
              onChange={handleInputChange}
              placeholder={t("deleteServerModal.placeholder")}
              error={error}
              helperText={error ? t("deleteServerModal.error") : ""}
              autoFocus
              disabled={isDeleting}
              onKeyPress={(e): void => {
                if (e.key === "Enter" && !isDeleting) {
                  handleConfirm();
                }
              }}
            />
          </Box>

          {/* Progress indicator */}
          {isDeleting && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <CircularProgress size={24} color="error" />
              <Typography variant="body2" color="text.secondary">
                {t("deleteServerModal.deleting")}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={isDeleting}>
          {t("deleteServerModal.cancel")}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={!inputValue || isDeleting}
        >
          {isDeleting ? <CircularProgress size={20} color="inherit" /> : t("deleteServerModal.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
