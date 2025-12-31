import React from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";

interface DownloadProgressModalProps {
  open: boolean;
  title: string;
  message: string;
  warning?: string;
}

export const DownloadProgressModal: React.FC<DownloadProgressModalProps> = ({
  open,
  title,
  message,
  warning,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "background.paper",
        },
      }}
    >
      <DialogContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
            gap: 3,
          }}
        >
          {/* Spinner */}
          <CircularProgress size={60} thickness={4} />

          {/* Title */}
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>

          {/* Progress Message */}
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              textAlign: "center",
              minHeight: "24px",
            }}
          >
            {message || t("common.preparing")}
          </Typography>

          {/* Progress Bar */}
          <Box sx={{ width: "100%", mt: 2 }}>
            <LinearProgress />
          </Box>

          {/* Warning */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              textAlign: "center",
              mt: 1,
            }}
          >
            {warning || t("common.doNotClose")}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
