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
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useTranslation } from "react-i18next";
import { monoFont } from "@renderer/theme";

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
        {type === "download" ? (
          <CloudDownloadIcon color="primary" />
        ) : (
          <CloudUploadIcon color="success" />
        )}
        {type === "download" ? t("transfer.downloading") : t("transfer.uploading")}
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
          <Box sx={{ position: "relative", display: "inline-flex" }}>
            <CircularProgress variant="determinate" value={percent} size={96} thickness={3} />
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography sx={{ fontFamily: monoFont, fontSize: 20 }}>{`${percent}%`}</Typography>
            </Box>
          </Box>

          <Typography sx={{ fontFamily: monoFont, fontSize: 14 }}>
            {transferred} / {total}
          </Typography>

          <Box sx={{ width: "100%" }}>
            <LinearProgress
              variant="determinate"
              value={percent}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: "#262c38",
                "& .MuiLinearProgress-bar": { borderRadius: 3 },
              }}
            />
          </Box>

          <Typography variant="caption" color="text.secondary">
            {t("common.doNotClose")}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
