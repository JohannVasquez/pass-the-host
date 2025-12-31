import React from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useTranslation } from "react-i18next";

interface TransferProgressModalProps {
  open: boolean;
  type: "download" | "upload";
  percent: number;
  transferred: string;
  total: string;
}

export const TransferProgressModal: React.FC<TransferProgressModalProps> = ({
  open,
  type,
  percent,
  transferred,
  total,
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
          {/* Icon */}
          {type === "download" ? (
            <CloudDownloadIcon sx={{ fontSize: 60, color: "primary.main" }} />
          ) : (
            <CloudUploadIcon sx={{ fontSize: 60, color: "primary.main" }} />
          )}

          {/* Title */}
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            {type === "download" ? t("transfer.downloading") : t("transfer.uploading")}
          </Typography>

          {/* Progress Percentage */}
          <Box sx={{ position: "relative", display: "inline-flex" }}>
            <CircularProgress
              variant="determinate"
              value={percent}
              size={120}
              thickness={4}
              sx={{
                color: type === "download" ? "primary.main" : "success.main",
              }}
            />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: "absolute",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography
                variant="h4"
                component="div"
                color="text.primary"
                sx={{ fontWeight: 600 }}
              >
                {`${percent}%`}
              </Typography>
            </Box>
          </Box>

          {/* Transfer Details */}
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              {transferred} / {total}
            </Typography>
          </Box>

          {/* Progress Bar */}
          <Box sx={{ width: "100%", mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={percent}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(0, 0, 0, 0.1)",
                "& .MuiLinearProgress-bar": {
                  backgroundColor: type === "download" ? "primary.main" : "success.main",
                },
              }}
            />
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
            {t("common.doNotClose")}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
