import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useTranslation } from "react-i18next";
import { UsernameInput } from "./UsernameInput";
import { TurnSettings } from "@contexts/p2p-tunnel/presentation/components/TurnSettings";
import { ModsFolderSettings } from "@contexts/p2p-tunnel/presentation/components/ModsFolderSettings";
import { PrivacySettings } from "@contexts/p2p-tunnel/presentation/components/PrivacySettings";
import { surface } from "@renderer/theme";

const accordionSx = {
  bgcolor: surface.panel,
  border: 1,
  borderColor: surface.border,
  borderRadius: 1,
  "&:before": { display: "none" },
  "&.Mui-expanded": { margin: 0 },
  "& .MuiAccordionSummary-root": { minHeight: 48, px: 2 },
  "& .MuiAccordionSummary-content": { alignItems: "baseline", gap: 1, my: 1 },
  "& .MuiAccordionDetails-root": { px: 2, pb: 2, pt: 2, borderTop: 1, borderColor: "divider" },
};

interface SettingsModalProps {
  open: boolean;
  username: string;
  onSaveUsername: (username: string) => void;
  usernameDisabled: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  username,
  onSaveUsername,
  usernameDisabled,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, fontSize: 16, fontWeight: 600 }}>
        <SettingsOutlinedIcon sx={{ color: "#b4bac6" }} />
        {t("settings.title")}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <UsernameInput username={username} onSave={onSaveUsername} disabled={usernameDisabled} />
          <ModsFolderSettings />
          <Accordion disableGutters sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">{t("settings.advanced")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t("p2p.turn.title")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TurnSettings />
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters sx={accordionSx}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">{t("p2p.privacy.title")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t("p2p.privacy.subtitle")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <PrivacySettings />
            </AccordionDetails>
          </Accordion>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, height: 64, borderTop: 1, borderColor: "divider" }}>
        <Button onClick={onClose} sx={{ color: "#b4bac6" }}>{t("settings.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};
