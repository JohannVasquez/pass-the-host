import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { PanelTitle } from "@renderer/presentation/components/PanelTitle";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { monoFont, surface } from "@renderer/theme";
import type { P2PGroup } from "@preload/index.d";
import {
  joinServer,
  startHosting,
  type JoinedServer,
} from "@contexts/p2p-tunnel/infrastructure/PeerTunnel";
import type { DiagCode } from "@contexts/p2p-tunnel/infrastructure/signaling";
import { resetRealtime } from "@contexts/p2p-tunnel/infrastructure/Realtime";
import {
  watchPresence,
  type NetworkPresence,
  type OnlineMember,
} from "@contexts/p2p-tunnel/infrastructure/NetworkPresence";
import {
  hostingChanges,
  type HostingChange,
} from "@contexts/p2p-tunnel/infrastructure/hostingChanges";
import { MembersDialog } from "@contexts/p2p-tunnel/presentation/components/MembersDialog";
import { RoomsInfoDialog } from "@contexts/p2p-tunnel/presentation/components/RoomsInfoDialog";

const MINECRAFT_PORT = 25565;
const GROUP_STORAGE_KEY = "p2p.groupId";
const AUTO_CONNECT_STORAGE_KEY = "p2p.autoConnect";
// Reused when the Minecraft port is busy, so the friend's saved server entry keeps working
const FALLBACK_PORT_STORAGE_KEY = "p2p.fallbackPort";

type Mode = "join" | "create";

interface P2PPanelProps {
  serverRunning: boolean;
  /** Server starting, running or stopping: our own server needs the Minecraft port */
  serverActive: boolean;
  serverPort: number;
  username: string;
  /** Name of the selected Minecraft server, announced to the network while hosting */
  serverName: string | null;
  /** Writes to the console the user sees */
  onLog?: (message: string, type: "info" | "success" | "warning" | "error") => void;
}

const readStoredGroup = (): string => {
  try {
    return localStorage.getItem(GROUP_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

const readAutoConnect = (): boolean => {
  try {
    return localStorage.getItem(AUTO_CONNECT_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};

const readFallbackPort = (): number => {
  try {
    return Number(localStorage.getItem(FALLBACK_PORT_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

const saveFallbackPort = (port: number): void => {
  try {
    localStorage.setItem(FALLBACK_PORT_STORAGE_KEY, String(port));
  } catch {
    // Without storage the port is simply picked again next time
  }
};

const errorCode = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+': /, "")
    .replace(/^Error: /, "");

/** ABCDEFGHJKLM → ABCD-EFGH-JKLM */
const formatCode = (code: string): string => code.match(/.{1,4}/g)?.join("-") ?? code;

const CopyField: React.FC<{
  label: string;
  value: string;
  copyLabel: string;
  onCopy: () => void;
  /** Highlights a value the user must not take for granted */
  warning?: boolean;
}> = ({ label, value, copyLabel, onCopy, warning = false }) => (
  <Stack
    direction="row"
    alignItems="center"
    spacing={1.5}
    sx={{
      minHeight: 44,
      pl: 1.5,
      pr: 0.75,
      borderRadius: 1,
      bgcolor: surface.base,
      border: 1,
      borderColor: warning ? "warning.main" : surface.border,
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography
      noWrap
      sx={{ fontFamily: monoFont, color: warning ? "warning.main" : "primary.main", flexGrow: 1 }}
    >
      {value}
    </Typography>
    <Tooltip title={copyLabel}>
      <IconButton size="small" onClick={onCopy} aria-label={copyLabel}>
        <ContentCopyIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  </Stack>
);

export const P2PPanel: React.FC<P2PPanelProps> = ({
  serverRunning,
  serverActive,
  serverPort,
  username,
  serverName,
  onLog,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [groups, setGroups] = React.useState<P2PGroup[]>([]);
  const [groupId, setGroupId] = React.useState<string>(readStoredGroup);
  const [mode, setMode] = React.useState<Mode>("join");
  const [newGroupName, setNewGroupName] = React.useState("");
  const [codeInput, setCodeInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [hosting, setHosting] = React.useState(false);
  const [joined, setJoined] = React.useState<JoinedServer | null>(null);
  // Destructive room actions wait for confirmation: delete (creator) or leave (member)
  const [confirm, setConfirm] = React.useState<"delete" | "leave" | null>(null);
  const [membersOpen, setMembersOpen] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  // null until presence works (e.g. the Ably key may lack the presence capability)
  const [online, setOnline] = React.useState<OnlineMember[] | null>(null);
  // Bumped whenever the Ably connection is replaced, so channel users re-attach
  const [realtimeEpoch, setRealtimeEpoch] = React.useState(0);
  const presenceRef = React.useRef<NetworkPresence | null>(null);
  const hostingSinceRef = React.useRef<number | null>(null);

  // Read from long-lived tunnel callbacks without re-subscribing
  const onlineRef = React.useRef(online);
  onlineRef.current = online;
  const onLogRef = React.useRef(onLog);
  onLogRef.current = onLog;
  const log = React.useCallback(
    (message: string, type: "info" | "success" | "warning" | "error"): void =>
      onLogRef.current?.(`[P2P] ${message}`, type),
    [],
  );
  const nameOf = (clientId: string): string =>
    onlineRef.current?.find((member) => member.clientId === clientId)?.name ?? "A friend";

  const selectedGroup = groups.find((group) => group.id === groupId);
  const hosts = online?.filter((member) => member.hosting && !member.isYou) ?? [];

  const showError = React.useCallback(
    (error: unknown) => {
      const code = errorCode(error);
      enqueueSnackbar(
        t(`p2p.errors.${code}`, { defaultValue: t("p2p.errors.generic", { code }) }),
        { variant: "error" },
      );
    },
    [enqueueSnackbar, t],
  );

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const refreshGroups = React.useCallback(async (selectId?: string) => {
    const list = await window.p2pAPI.listGroups();
    setGroups(list);
    setGroupId((current) => {
      const wanted = selectId ?? current;
      return list.some((group) => group.id === wanted) ? wanted : (list[0]?.id ?? "");
    });
  }, []);

  // The first call registers this device with the API, no login needed
  React.useEffect(() => {
    refreshGroups().catch(showError);
  }, [refreshGroups, showError]);

  // Other members see this name in the network's member list
  React.useEffect(() => {
    if (username) window.p2pAPI.setDisplayName(username).catch(showError);
  }, [username, showError]);

  React.useEffect(() => {
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, groupId);
    } catch {
      // Storage unavailable: the selection just won't survive a restart
    }
  }, [groupId]);

  // Desktop notification when a friend starts or stops hosting in the selected network
  const notifyHosting = ({ type, member }: HostingChange): void => {
    const vars = {
      name: member.name,
      server: member.serverName ?? selectedGroup?.name ?? "",
      network: selectedGroup?.name ?? "",
    };
    const minutes = Math.floor((Date.now() - (member.hostingSince ?? Date.now())) / 60_000);
    const duration =
      minutes < 1
        ? t("p2p.notify.lessThanMinute")
        : minutes < 60
          ? t("p2p.notify.minutes", { m: minutes })
          : t("p2p.notify.hoursMinutes", { h: Math.floor(minutes / 60), m: minutes % 60 });
    void window.notificationAPI.show(
      t(`p2p.notify.${type}Title`, vars),
      t(`p2p.notify.${type}Body`, { ...vars, duration }),
    );
  };
  // Read from the presence callback without re-subscribing on every render
  const notifyRef = React.useRef(notifyHosting);
  notifyRef.current = notifyHosting;

  // Presence: everyone with the app open on this network, and who is hosting
  React.useEffect(() => {
    if (!groupId) return undefined;
    let last: OnlineMember[] | null = null;
    const onChange = (next: OnlineMember[]): void => {
      for (const change of hostingChanges(last, next)) notifyRef.current(change);
      last = next;
      setOnline(next);
    };
    const presence = watchPresence(groupId, onChange, (error) => {
      console.warn("P2P presence unavailable", error);
      setOnline(null);
    });
    presenceRef.current = presence;
    return () => {
      presence.leave();
      presenceRef.current = null;
      setOnline(null);
    };
  }, [groupId, realtimeEpoch]);

  // Someone joined since the room list was fetched: refetch so the member count catches up
  const refreshedForCount = React.useRef(0);
  React.useEffect(() => {
    const count = online?.length ?? 0;
    if (selectedGroup && count > selectedGroup.memberCount && count > refreshedForCount.current) {
      refreshedForCount.current = count;
      refreshGroups().catch(showError);
    }
  }, [online, selectedGroup, refreshGroups, showError]);

  // Runs after the effect above, so it also enters presence for a new network
  React.useEffect(() => {
    if (!hosting) hostingSinceRef.current = null;
    else hostingSinceRef.current ??= Date.now();
    if (!username) return;
    presenceRef.current?.set({
      name: username,
      hosting,
      ...(hosting && {
        serverName: serverName ?? undefined,
        hostingSince: hostingSinceRef.current ?? undefined,
      }),
    });
  }, [username, hosting, serverName, groupId, realtimeEpoch]);

  const reconnectRealtime = (): void => {
    resetRealtime();
    setRealtimeEpoch((epoch) => epoch + 1);
  };

  // Host: while the server runs, answer friends of the selected group
  React.useEffect(() => {
    if (!groupId || !serverRunning) return undefined;
    let stop: (() => void) | null = null;
    let cancelled = false;
    let lastTcpError = 0;
    const offTcpError = window.p2pAPI.onTcpError((_connId, message) => {
      // The multiplayer screen pings constantly: one line per few seconds is enough
      if (Date.now() - lastTcpError < 5_000) return;
      lastTcpError = Date.now();
      log(`Couldn't reach your Minecraft server on port ${serverPort}: ${message}`, "error");
    });
    startHosting(groupId, serverPort, {
      onOpened: (from) => log(`${nameOf(from)} connected to your server through the room`, "info"),
      onClosed: (from) => log(`${nameOf(from)}'s connection to your server closed`, "warning"),
      onDiag: ({ from, code, detail }) => {
        const name = nameOf(from);
        if (code === "port_changed")
          log(
            `${name} is using localhost:${detail} because ${MINECRAFT_PORT} was busy on their PC`,
            "warning",
          );
        else if (code === "channel_failed")
          log(`${name}'s connection to your server hit a data channel error`, "warning");
        else if (code === "tunnel_failed")
          log(`${name} couldn't connect to your server${detail ? ` (${detail})` : ""}`, "warning");
        else if (code === "tunnel_closed")
          log(`${name}'s tunnel closed, so their localhost:${detail} port was shut`, "warning");
      },
    }).then((stopHosting) => {
      if (cancelled) return stopHosting();
      stop = stopHosting;
      setHosting(true);
    }, showError);
    return () => {
      cancelled = true;
      offTcpError();
      stop?.();
      setHosting(false);
    };
  }, [groupId, serverRunning, serverPort, showError, realtimeEpoch, log]);

  const handleCreateGroup = (): Promise<void> =>
    run(async () => {
      const group = await window.p2pAPI.createGroup(newGroupName.trim());
      reconnectRealtime();
      setNewGroupName("");
      await refreshGroups(group.id);
      enqueueSnackbar(t("p2p.groupCreated"), { variant: "success" });
    });

  const handleJoinGroup = (): Promise<void> =>
    run(async () => {
      const group = await window.p2pAPI.joinGroup(codeInput);
      reconnectRealtime();
      setCodeInput("");
      await refreshGroups(group.id);
      enqueueSnackbar(t("p2p.groupJoined", { name: group.name }), { variant: "success" });
    });

  const handleConfirmed = (): Promise<void> =>
    run(async () => {
      const action = confirm;
      setConfirm(null);
      if (action === "delete") await window.p2pAPI.deleteGroup(groupId);
      else await window.p2pAPI.leaveGroup(groupId);
      reconnectRealtime();
      await refreshGroups();
      enqueueSnackbar(t(action === "delete" ? "p2p.groupDeleted" : "p2p.groupLeft"), {
        variant: "success",
      });
    });

  // "Delete my data" lives in Settings: start over with whatever this device is now
  React.useEffect(() => {
    const onDeleted = (): void => {
      setJoined((current) => {
        current?.stop();
        return null;
      });
      resetRealtime();
      setRealtimeEpoch((epoch) => epoch + 1);
      refreshGroups().catch(showError);
    };
    window.addEventListener("p2p:data-deleted", onDeleted);
    return () => window.removeEventListener("p2p:data-deleted", onDeleted);
  }, [refreshGroups, showError]);

  const handleCopyCode = async (): Promise<void> => {
    if (!selectedGroup) return;
    await navigator.clipboard.writeText(formatCode(selectedGroup.inviteCode));
    enqueueSnackbar(t("p2p.inviteCopied"), { variant: "success" });
  };

  // A leaked code stops working; people already in the room stay
  const handleRotateCode = (): Promise<void> =>
    run(async () => {
      await window.p2pAPI.rotateInviteCode(groupId);
      await refreshGroups();
      enqueueSnackbar(t("p2p.codeRotated"), { variant: "success" });
    });

  // What the friend pastes into Minecraft's Multiplayer screen
  const handleCopyAddress = async (port: number): Promise<void> => {
    await navigator.clipboard.writeText(`localhost:${port}`);
    enqueueSnackbar(t("p2p.addressCopied"), { variant: "success" });
  };

  // Only the chosen host's answer is accepted, so joining needs presence to know who hosts
  const handleConnect = (): Promise<void> =>
    run(async () => {
      const target = hosts[0];
      if (!target) throw new Error("p2p_host_not_found");
      const hostName = target.name;
      let port = 0;
      const onNotice = (code: DiagCode, detail?: string): void => {
        if (code === "joined") {
          port = Number(detail);
          log(
            `Connected to ${hostName}'s server. In Minecraft, use localhost:${detail}`,
            "success",
          );
        } else if (code === "port_changed")
          log(`Port ${MINECRAFT_PORT} was busy, so the tunnel uses localhost:${detail}`, "warning");
        else if (code === "tunnel_failed")
          log(`Couldn't connect to ${hostName}'s server${detail ? ` (${detail})` : ""}`, "error");
        else if (code === "tunnel_closed")
          log(
            `Lost the connection to ${hostName}. Minecraft at localhost:${port} will be refused until you reconnect`,
            "warning",
          );
      };
      const tunnel = await joinServer(
        groupId,
        target.clientId,
        [MINECRAFT_PORT, readFallbackPort()],
        () => {
          setJoined(null);
          enqueueSnackbar(t("p2p.disconnected"), { variant: "warning" });
        },
        onNotice,
      );
      if (tunnel.port !== MINECRAFT_PORT) saveFallbackPort(tunnel.port);
      setJoined(tunnel);
    });

  const handleDisconnect = (): void => {
    joined?.stop();
    setJoined(null);
  };

  // Auto-connect: join as soon as someone in the room starts hosting
  const [autoConnect, setAutoConnect] = React.useState(readAutoConnect);
  // One attempt per hosting session (host + start time): a failure or a manual
  // disconnect waits for the next time someone starts a server
  const attemptedRef = React.useRef<string | null>(null);
  const connectRef = React.useRef(handleConnect);
  connectRef.current = handleConnect;
  const host = hosts[0];
  const hostSession = host ? `${host.clientId}:${host.hostingSince ?? ""}` : null;

  React.useEffect(() => {
    try {
      localStorage.setItem(AUTO_CONNECT_STORAGE_KEY, String(autoConnect));
    } catch {
      // Storage unavailable: the choice just won't survive a restart
    }
  }, [autoConnect]);

  React.useEffect(() => {
    if (!autoConnect || !hostSession || joined || busy || serverActive) return;
    if (attemptedRef.current === hostSession) return;
    attemptedRef.current = hostSession;
    void connectRef.current();
  }, [autoConnect, hostSession, joined, busy, serverActive]);

  // Our own server is starting: free the Minecraft port the tunnel may hold
  React.useEffect(() => {
    if (!serverActive) return;
    setJoined((current) => {
      current?.stop();
      return null;
    });
  }, [serverActive]);

  return (
    <Paper sx={{ p: 2, bgcolor: surface.panel }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <PanelTitle icon={<GroupsOutlinedIcon />}>{t("p2p.title")}</PanelTitle>
        <Tooltip title={t("p2p.info.button")}>
          <IconButton
            size="small"
            onClick={() => setInfoOpen(true)}
            aria-label={t("p2p.info.button")}
          >
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={2}>
        {selectedGroup ? (
          <>
            <Stack direction="row" spacing={1} alignItems="center">
              <GroupsOutlinedIcon sx={{ color: "primary.main" }} />
              <Select
                variant="standard"
                disableUnderline
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={busy || hosting || joined !== null}
                inputProps={{ "aria-label": t("p2p.group") }}
                sx={{ fontWeight: 600, fontSize: 15, minWidth: 0, maxWidth: 160 }}
              >
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))}
              </Select>
              <Tooltip title={t("p2p.viewMembers")}>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    setMembersOpen(true);
                    refreshGroups().catch(showError);
                  }}
                  startIcon={<PeopleOutlineIcon />}
                  aria-label={t("p2p.viewMembers")}
                  sx={{
                    minWidth: 0,
                    flexShrink: 0,
                    px: 1,
                    bgcolor: "action.hover",
                    fontFamily: monoFont,
                    fontSize: 12,
                  }}
                >
                  {online
                    ? `${online.length}/${selectedGroup.memberCount}`
                    : selectedGroup.memberCount}
                </Button>
              </Tooltip>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                aria-label={t("p2p.roomActions")}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={menuAnchor !== null}
                onClose={() => setMenuAnchor(null)}
              >
                {selectedGroup.isOwner && (
                  <MenuItem
                    disabled={busy}
                    onClick={() => {
                      setMenuAnchor(null);
                      void handleRotateCode();
                    }}
                  >
                    <ListItemIcon>
                      <AutorenewIcon fontSize="small" />
                    </ListItemIcon>
                    {t("p2p.rotateCode")}
                  </MenuItem>
                )}
                <MenuItem
                  disabled={busy || hosting || joined !== null}
                  onClick={() => {
                    setMenuAnchor(null);
                    setConfirm(selectedGroup.isOwner ? "delete" : "leave");
                  }}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon sx={{ color: "inherit" }}>
                    {selectedGroup.isOwner ? (
                      <DeleteOutlineIcon fontSize="small" />
                    ) : (
                      <LogoutIcon fontSize="small" />
                    )}
                  </ListItemIcon>
                  {t(selectedGroup.isOwner ? "p2p.deleteGroup" : "p2p.leaveGroup")}
                </MenuItem>
              </Menu>
            </Stack>

            <CopyField
              label={t("p2p.inviteCode")}
              value={formatCode(selectedGroup.inviteCode)}
              copyLabel={t("p2p.copyInvite")}
              onCopy={handleCopyCode}
            />

            {serverRunning ? (
              <Alert severity={hosting ? "success" : "info"}>
                {hosting ? t("p2p.hosting") : t("p2p.connecting")}
              </Alert>
            ) : joined ? (
              <Box>
                <Alert severity="success" sx={{ mb: 1, py: 0.5 }}>
                  {t("p2p.connected")}
                </Alert>
                <Box sx={{ mb: 1 }}>
                  <CopyField
                    label={t("p2p.serverAddress")}
                    value={`localhost:${joined.port}`}
                    copyLabel={t("p2p.copyAddress")}
                    onCopy={() => handleCopyAddress(joined.port)}
                    warning={joined.port !== MINECRAFT_PORT}
                  />
                  {joined.port !== MINECRAFT_PORT && (
                    <Typography
                      variant="caption"
                      color="warning.main"
                      sx={{ display: "block", mt: 0.75 }}
                    >
                      {t("p2p.portBusyHint", { port: MINECRAFT_PORT })}
                    </Typography>
                  )}
                </Box>
                <Button fullWidth variant="outlined" color="warning" onClick={handleDisconnect}>
                  {t("p2p.disconnect")}
                </Button>
              </Box>
            ) : (
              <Box>
                {online && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {hosts.length > 0
                      ? t("p2p.hostingNow", { name: hosts.map((host) => host.name).join(", ") })
                      : t("p2p.nobodyHosting")}
                  </Typography>
                )}
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleConnect}
                  disabled={busy || hosts.length === 0}
                  startIcon={busy ? <CircularProgress size={16} /> : undefined}
                >
                  {busy ? t("p2p.connecting") : t("p2p.connect")}
                </Button>
              </Box>
            )}
            {!serverRunning && (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={autoConnect}
                    onChange={(e) => setAutoConnect(e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{t("p2p.autoConnect")}</Typography>}
              />
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("p2p.noGroups")}
          </Typography>
        )}

        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          fullWidth
          onChange={(_e, value: Mode | null) => value && setMode(value)}
          disabled={busy}
        >
          <ToggleButton value="join">{t("p2p.modeJoin")}</ToggleButton>
          <ToggleButton value="create">{t("p2p.modeCreate")}</ToggleButton>
        </ToggleButtonGroup>

        {mode === "join" ? (
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              label={t("p2p.inviteCode")}
              placeholder="XXXX-XXXX-XXXX"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && codeInput.trim() && void handleJoinGroup()}
              slotProps={{ htmlInput: { maxLength: 20, style: { fontFamily: monoFont } } }}
              disabled={busy}
            />
            <Button onClick={handleJoinGroup} disabled={busy || !codeInput.trim()}>
              {t("p2p.join")}
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              label={t("p2p.newGroupName")}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && newGroupName.trim() && void handleCreateGroup()
              }
              slotProps={{ htmlInput: { maxLength: 50 } }}
              disabled={busy}
            />
            <Button onClick={handleCreateGroup} disabled={busy || !newGroupName.trim()}>
              {t("p2p.create")}
            </Button>
          </Stack>
        )}
      </Stack>

      {selectedGroup && (
        <MembersDialog
          open={membersOpen}
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          canRemove={selectedGroup.isOwner}
          online={online}
          onRemoved={(name) => {
            enqueueSnackbar(t("p2p.memberRemoved", { name }), { variant: "success" });
            refreshGroups().catch(showError);
          }}
          onError={showError}
          onClose={() => setMembersOpen(false)}
        />
      )}

      <RoomsInfoDialog open={infoOpen} onClose={() => setInfoOpen(false)} />

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t(confirm === "leave" ? "p2p.leaveConfirmTitle" : "p2p.deleteConfirmTitle", {
            name: selectedGroup?.name,
          })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(confirm === "leave" ? "p2p.leaveConfirmBody" : "p2p.deleteConfirmBody")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>{t("p2p.cancel")}</Button>
          <Button color="error" variant="contained" onClick={handleConfirmed}>
            {t(confirm === "leave" ? "p2p.leaveGroup" : "p2p.deleteGroup")}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
