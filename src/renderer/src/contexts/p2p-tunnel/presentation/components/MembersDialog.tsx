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
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tooltip,
} from "@mui/material";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonRemoveOutlinedIcon from "@mui/icons-material/PersonRemoveOutlined";
import { useTranslation } from "react-i18next";
import type { P2PMember } from "@preload/index.d";
import type { OnlineMember } from "@contexts/p2p-tunnel/infrastructure/NetworkPresence";

interface MembersDialogProps {
  open: boolean;
  groupId: string;
  groupName: string;
  /** The creator can remove other members */
  canRemove: boolean;
  /** null when presence isn't available: online status is then left out */
  online: OnlineMember[] | null;
  onRemoved: (name: string) => void;
  onError: (error: unknown) => void;
  onClose: () => void;
}

export const MembersDialog: React.FC<MembersDialogProps> = ({
  open,
  groupId,
  groupName,
  canRemove,
  online,
  onRemoved,
  onError,
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

  const remove = (member: P2PMember, name: string): void => {
    window.p2pAPI.removeMember(groupId, member.id).then(() => {
      setMembers((current) => current?.filter((entry) => entry.id !== member.id) ?? null);
      onRemoved(name);
    }, onError);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <GroupsOutlinedIcon sx={{ color: "primary.main" }} />
        {t("p2p.membersTitle", { name: groupName })}
      </DialogTitle>
      <DialogContent>
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
                  divider
                  sx={{ minHeight: 56 }}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      {presence?.hosting && (
                        <Chip size="small" color="success" variant="outlined" label={t("p2p.hostingChip")} />
                      )}
                      {member.isOwner && <Chip size="small" label={t("p2p.creator")} />}
                      {canRemove && !member.isOwner && (
                        <Tooltip title={t("p2p.removeMember")}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => remove(member, name)}
                            aria-label={`${t("p2p.removeMember")}: ${name}`}
                          >
                            <PersonRemoveOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
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
                      <Avatar sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 600 }}>{name[0]?.toUpperCase()}</Avatar>
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
