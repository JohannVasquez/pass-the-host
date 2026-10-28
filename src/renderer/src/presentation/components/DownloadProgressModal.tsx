import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { monoFont } from "@renderer/theme";

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
    <Dialog open={open} disableEscapeKeyDown maxWidth="xs" fullWidth>
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
        {title}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: 2,
            gap: 2,
            textAlign: "center",
          }}
        >
          <CircularProgress size={40} thickness={4} />

          <Typography sx={{ fontFamily: monoFont, fontSize: 14, minHeight: 21 }}>
            {message || t("common.preparing")}
          </Typography>

          <Box sx={{ width: "100%" }}>
            <LinearProgress
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: "#262c38",
                "& .MuiLinearProgress-bar": { borderRadius: 3 },
              }}
            />
          </Box>

          <Typography variant="caption" color="text.secondary">
            {warning || t("common.doNotClose")}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
