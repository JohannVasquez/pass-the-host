import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { surface } from "@renderer/theme";

interface OfflineCloudServerModalProps {
  open: boolean;
  provider: string;
  onCancel: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
}

/** localStorage key: "hidden" once the user ticks "don't show again" */
export const OFFLINE_CLOUD_WARNING_KEY = "offlineCloudServerWarning";

/** Asks before starting a local copy of a cloud server that can't be synced right now */
export const OfflineCloudServerModal: React.FC<OfflineCloudServerModalProps> = ({
  open,
  provider,
  onCancel,
  onConfirm,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
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
        <WarningAmberIcon color="warning" />
        {t("offlineCloudServer.title")}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {t("serverControl.cloudCopyNotSynced", { provider })}
        </Typography>
        <FormControlLabel
          sx={{ mt: 1.5 }}
          control={
            <Checkbox
              size="small"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
          }
          label={<Typography variant="body2">{t("offlineCloudServer.dontShowAgain")}</Typography>}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1, borderTop: `1px solid ${surface.border}` }}>
        <Button onClick={onCancel} color="inherit">
          {t("offlineCloudServer.cancel")}
        </Button>
        <Button onClick={() => onConfirm(dontShowAgain)} variant="contained" color="warning">
          {t("offlineCloudServer.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
