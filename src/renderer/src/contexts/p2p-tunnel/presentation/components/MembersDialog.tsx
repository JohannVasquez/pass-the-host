import React from "react";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { P2PMember } from "@preload/index.d";
import type { OnlineMember } from "@contexts/p2p-tunnel/infrastructure/NetworkPresence";

interface MembersDialogProps {
  open: boolean;
  groupId: string;
  groupName: string;
  /** null when presence isn't available: online status is then left out */
  online: OnlineMember[] | null;
  onClose: () => void;
}

export const MembersDialog: React.FC<MembersDialogProps> = ({
  open,
  groupId,
  groupName,
  online,
  onClose,
}) => {
  const { t } = useTranslation();
  const [members, setMembers] = React.useState<P2PMember[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setMembers(null);
    setFailed(false);
    window.p2pAPI.listMembers(groupId).then(setMembers, () => setFailed(true));
  }, [open, groupId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("p2p.membersTitle", { name: groupName })}</DialogTitle>
      <DialogContent dividers>
        {failed ? (
          t("p2p.errors.generic", { code: "members" })
        ) : !members ? (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : (
          <List dense disablePadding>
            {members.map((member) => {
              const name = member.name ?? t("p2p.unnamed");
              const presence = online?.find((entry) => entry.clientId === member.id);
              return (
                <ListItem
                  key={member.id}
                  disableGutters
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      {presence?.hosting && (
                        <Chip size="small" color="success" label={t("p2p.hostingChip")} />
                      )}
                      {member.isOwner && <Chip size="small" label={t("p2p.creator")} />}
                    </Stack>
                  }
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                      variant="dot"
                      color="success"
                      invisible={!presence}
                      aria-label={presence ? t("p2p.online") : undefined}
                    >
                      <Avatar sx={{ width: 32, height: 32 }}>{name[0]?.toUpperCase()}</Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.isYou ? `${name} (${t("p2p.you")})` : name}
                    slotProps={{
                      primary: { color: member.name ? "text.primary" : "text.secondary" },
                    }}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("p2p.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};
