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
  CircularProgress,
} from "@mui/material";
import { Badge as BadgeIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface UsernameRequiredModalProps {
  open: boolean;
  onSave: (username: string) => Promise<boolean>;
}

// No onClose on purpose: the app needs a username before anything else works
export const UsernameRequiredModal: React.FC<UsernameRequiredModalProps> = ({ open, onSave }) => {
  const { t } = useTranslation();
  const [value, setValue] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState(false);

  const handleSave = async (): Promise<void> => {
    const trimmed = value.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    setError(!(await onSave(trimmed).catch(() => false)));
    setIsSaving(false);
  };

  return (
    <Dialog open={open} maxWidth="xs" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <BadgeIcon color="primary" />
          {t("usernameRequiredModal.title")}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("usernameRequiredModal.description")}
        </Typography>
        <TextField
          fullWidth
          autoFocus
          value={value}
          placeholder={t("username.placeholder")}
          disabled={isSaving}
          error={error}
          helperText={error ? t("usernameRequiredModal.error") : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={handleSave} disabled={!value.trim() || isSaving}>
          {isSaving ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            t("usernameRequiredModal.save")
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
