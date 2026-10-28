import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";

// The site only has Spanish and English versions of the policy
const policyUrl = (language: string): string =>
  `https://passthehost.jvdev.cl/${language.startsWith("es") ? "es" : "en"}/privacy`;

export const PrivacySettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const handleDelete = async (): Promise<void> => {
    setBusy(true);
    try {
      await window.p2pAPI.deleteMyData();
      // The Rooms panel resets itself on this event
      window.dispatchEvent(new Event("p2p:data-deleted"));
      enqueueSnackbar(t("p2p.privacy.deleted"), { variant: "success" });
      setConfirming(false);
    } catch {
      enqueueSnackbar(t("p2p.privacy.deleteFailed"), { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ color: "#c9ced8", lineHeight: 1.6 }}>
        {t("p2p.privacy.description")}{" "}
        <Link href={policyUrl(i18n.language)} target="_blank" rel="noreferrer">
          {t("p2p.privacy.policyLink")}
        </Link>
      </Typography>
      <Button
        variant="outlined"
        color="error"
        onClick={() => setConfirming(true)}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("p2p.privacy.deleteButton")}
      </Button>

      <Dialog open={confirming} onClose={() => !busy && setConfirming(false)} maxWidth="xs">
        <DialogTitle sx={{ fontSize: 16, fontWeight: 600 }}>{t("p2p.privacy.confirmTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13, color: "#c9ced8", lineHeight: 1.6 }}>{t("p2p.privacy.confirmBody")}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, height: 64, borderTop: 1, borderColor: "divider" }}>
          <Button onClick={() => setConfirming(false)} disabled={busy} sx={{ color: "#b4bac6" }}>
            {t("p2p.cancel")}
          </Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={busy}>
            {t("p2p.privacy.deleteButton")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
