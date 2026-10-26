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
import { useTranslation } from "react-i18next";
import { UsernameInput } from "./UsernameInput";
import { TurnSettings } from "@contexts/p2p-tunnel/presentation/components/TurnSettings";
import { PrivacySettings } from "@contexts/p2p-tunnel/presentation/components/PrivacySettings";

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
      <DialogTitle>{t("settings.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <UsernameInput username={username} onSave={onSaveUsername} disabled={usernameDisabled} />
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack>
                <Typography variant="subtitle1">{t("settings.advanced")}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("p2p.turn.title")}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <TurnSettings />
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack>
                <Typography variant="subtitle1">{t("p2p.privacy.title")}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("p2p.privacy.subtitle")}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <PrivacySettings />
            </AccordionDetails>
          </Accordion>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("settings.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};
