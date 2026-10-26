import React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import SettingsEthernetOutlinedIcon from "@mui/icons-material/SettingsEthernetOutlined";
import SportsEsportsOutlinedIcon from "@mui/icons-material/SportsEsportsOutlined";
import { useTranslation } from "react-i18next";

const STEPS = [
  { key: "step1", Icon: GroupAddOutlinedIcon },
  { key: "step2", Icon: NotificationsActiveOutlinedIcon },
  { key: "step3", Icon: SettingsEthernetOutlinedIcon },
  { key: "step4", Icon: SportsEsportsOutlinedIcon },
] as const;

interface RoomsInfoDialogProps {
  open: boolean;
  onClose: () => void;
}

export const RoomsInfoDialog: React.FC<RoomsInfoDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("p2p.info.title")}</DialogTitle>
      <DialogContent>
        <Box
          component="ol"
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1.5,
            m: 0,
            p: 0,
            listStyle: "none",
          }}
        >
          {STEPS.map(({ key, Icon }, index) => (
            <Paper component="li" key={key} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon />
                  </Box>
                  <Typography variant="overline" color="text.secondary">
                    {t("p2p.info.stepLabel", { n: index + 1 })}
                  </Typography>
                </Stack>
                <Typography variant="body2">{t(`p2p.info.${key}`)}</Typography>
              </Stack>
            </Paper>
          ))}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t("p2p.info.note")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("p2p.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};
