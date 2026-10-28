import React from "react";
import {
  Box,
  Button,
  Stack,
  Paper,
  Typography,
  Alert,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  LockOpen as LockOpenIcon,
  CloudSync as CloudSyncIcon,
  Edit as EditIcon,
  Add as AddIcon,
  FolderOpen as FolderOpenIcon,
  DeleteForever as DeleteForeverIcon,
  Share as ShareIcon,
  LockOutlined as LockIcon,
  MoreVert as MoreVertIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { monoFont, surface } from "@renderer/theme";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import { ServerStatus } from "@renderer/domain/entities/ServerStatus";
import { Server, ServerType } from "@renderer/domain/entities/Server";

const TYPE_LABELS: Record<ServerType, string> = {
  [ServerType.VANILLA]: "Vanilla",
  [ServerType.FORGE]: "Forge",
  [ServerType.NEOFORGE]: "NeoForge",
  [ServerType.PAPER]: "Paper",
  [ServerType.FABRIC]: "Fabric",
  [ServerType.UNKNOWN]: "",
};

const STATUS_COLORS: Record<ServerStatus, string> = {
  [ServerStatus.RUNNING]: "success.main",
  [ServerStatus.STOPPED]: "error.light",
  [ServerStatus.STARTING]: "warning.main",
  [ServerStatus.STOPPING]: "warning.main",
};

interface ServerControlPanelProps {
  status: ServerStatus;
  selectedServer: string | null;
  servers: Server[];
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
  onStartStop: () => void;
  onReleaseLock: () => void;
  onSyncToR2: () => void;
  onEditProperties: () => void;
  onOpenServerFolder: () => void;
  onDeleteServer: () => void;
  /** Only passed when sharing applies (Google Drive connected): the button is hidden otherwise */
  onShare?: () => void;
  cloudSyncEnabled?: boolean;
  serverStartTime: Date | null;
  username: string;
  lockedServerInfo?: {
    username: string;
    startedAt: string;
  };
}

const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const ServerControlPanel: React.FC<ServerControlPanelProps> = ({
  status,
  selectedServer,
  servers,
  onSelectServer,
  onCreateServer,
  onStartStop,
  onReleaseLock,
  onSyncToR2,
  onEditProperties,
  onOpenServerFolder,
  onDeleteServer,
  onShare,
  cloudSyncEnabled = false,
  serverStartTime,
  username,
  lockedServerInfo,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const isRunning = status === ServerStatus.RUNNING;
  const current = servers.find((server) => server.id === selectedServer);
  const details = current
    ? [
        current.type === ServerType.UNKNOWN ? null : TYPE_LABELS[current.type],
        current.version === "unknown" ? null : current.version,
      ].filter(Boolean)
    : [];
  const isTransitioning = status === ServerStatus.STARTING || status === ServerStatus.STOPPING;
  const [uptime, setUptime] = React.useState<string>("00:00:00");
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const isLocked = lockedServerInfo?.username && lockedServerInfo?.username !== "";
  const lockedByOther = isLocked && lockedServerInfo?.username !== username;

  // Update uptime every second when server is running
  React.useEffect(() => {
    if (!serverStartTime || !isRunning) {
      setUptime("00:00:00");
      return;
    }

    const updateUptime = (): void => {
      const now = new Date();
      const diff = now.getTime() - serverStartTime.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      setUptime(formatted);
    };

    updateUptime(); // Initial update
    const interval = setInterval(updateUptime, 1000);

    return () => clearInterval(interval);
  }, [serverStartTime, isRunning]);

  // Who holds the lock: a friend, or us while our server runs
  const lockOwner = lockedByOther
    ? {
        name: lockedServerInfo!.username,
        since: formatTime(new Date(lockedServerInfo!.startedAt)),
      }
    : isRunning && serverStartTime
      ? { name: `${username} (${t("serverControl.you")})`, since: formatTime(serverStartTime) }
      : null;

  const runMenuAction = (action: () => void) => (): void => {
    setMenuAnchor(null);
    action();
  };

  const menuItems = [
    {
      icon: <CloudSyncIcon fontSize="small" />,
      label: t("serverControl.syncToCloud"),
      onClick: onSyncToR2,
      disabled: !cloudSyncEnabled,
    },
    ...(onShare
      ? [
          {
            icon: <ShareIcon fontSize="small" />,
            label: t("serverControl.share"),
            onClick: onShare,
            disabled: false,
          },
        ]
      : []),
    {
      icon: <FolderOpenIcon fontSize="small" />,
      label: t("serverControl.openServerFolder"),
      onClick: onOpenServerFolder,
      disabled: false,
    },
    {
      icon: <EditIcon fontSize="small" />,
      label: t("serverControl.editProperties"),
      onClick: onEditProperties,
      disabled: false,
    },
    {
      icon: <LockOpenIcon fontSize="small" />,
      label: t("serverControl.releaseLock"),
      onClick: onReleaseLock,
      disabled: !cloudSyncEnabled,
    },
  ];

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1}>
        <Select
          size="small"
          fullWidth
          displayEmpty
          value={selectedServer || ""}
          onChange={(e) => onSelectServer(e.target.value)}
          disabled={isRunning || isTransitioning}
          inputProps={{ "aria-label": t("serverControl.selectServer") }}
          renderValue={(value) => (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 500 }}>
              <DnsOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
              {servers.find((server) => server.id === value)?.name ?? (
                <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                  {t("serverControl.selectServer")}
                </Box>
              )}
            </Box>
          )}
        >
          {servers.map((server) => (
            <MenuItem key={server.id} value={server.id}>
              {server.name}
            </MenuItem>
          ))}
        </Select>
        <Tooltip title={t("serverControl.createNewServer")}>
          <span>
            <IconButton
              onClick={onCreateServer}
              disabled={isRunning || isTransitioning}
              aria-label={t("serverControl.createNewServer")}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                border: 1,
                borderColor: servers.length === 0 ? "primary.main" : surface.border,
                color: servers.length === 0 ? "primary.main" : "text.secondary",
                bgcolor: surface.input,
              }}
            >
              <AddIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {!username && <Alert severity="error">{t("serverControl.usernameNotConfigured")}</Alert>}

      {lockedByOther && selectedServer && (
        <Alert severity="warning" icon={<LockIcon />}>
          <Typography variant="body2" fontWeight={600}>
            {t("serverControl.serverLocked")}
          </Typography>
          <Typography variant="caption">
            {t("serverControl.lockedBy", { username: lockedServerInfo?.username })}
          </Typography>
        </Alert>
      )}

      {!current ? (
        <Paper
          sx={{
            p: 4,
            textAlign: "center",
            borderStyle: "dashed",
            borderColor: surface.border,
          }}
        >
          <DnsOutlinedIcon sx={{ fontSize: 32, color: "text.secondary" }} />
          <Typography variant="h6" sx={{ mt: 1, mb: 2 }}>
            {servers.length === 0 ? t("serverControl.noServers") : t("serverControl.selectServer")}
          </Typography>
          {servers.length === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateServer}>
              {t("serverControl.createNewServer")}
            </Button>
          )}
        </Paper>
      ) : (
        <Paper sx={{ p: 2, bgcolor: surface.raised, borderColor: surface.border }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap sx={{ fontSize: 20, lineHeight: 1.2 }}>
                {current.name}
              </Typography>
              {details.length > 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontFamily: monoFont, textTransform: "uppercase", mt: 0.25 }}
                >
                  {details.join(" ")}
                </Typography>
              )}
            </Box>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label={t("serverControl.moreActions")}
              sx={{ borderRadius: 1, bgcolor: "action.hover", mr: -0.5, mt: -0.5 }}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              {menuItems.map((item) => (
                <MenuItem
                  key={item.label}
                  onClick={runMenuAction(item.onClick)}
                  disabled={item.disabled}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText>{item.label}</ListItemText>
                </MenuItem>
              ))}
              <Divider />
              <MenuItem
                onClick={runMenuAction(onDeleteServer)}
                disabled={isRunning || isTransitioning}
                sx={{ color: "error.light" }}
              >
                <ListItemIcon sx={{ color: "inherit" }}>
                  <DeleteForeverIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t("serverControl.deleteServer")}</ListItemText>
              </MenuItem>
            </Menu>
          </Box>

          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2 }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: 13,
                fontWeight: 500,
                color: STATUS_COLORS[status],
                textTransform: "capitalize",
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "currentColor" }} />
              {t(`serverStatus.${status}`)}
            </Box>
            <Typography
              sx={{
                fontFamily: monoFont,
                fontSize: 26,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: isRunning ? "text.primary" : "text.disabled",
              }}
            >
              {isRunning ? uptime : "--:--:--"}
            </Typography>
          </Box>

          <Button
            variant="contained"
            color={isRunning ? "error" : "primary"}
            startIcon={isRunning ? <StopIcon /> : <PlayIcon />}
            onClick={onStartStop}
            disabled={isTransitioning || (!isRunning && !username)}
            fullWidth
            sx={{ mt: 2, height: 40 }}
          >
            {isRunning ? t("serverControl.stop") : t("serverControl.start")}
          </Button>

          {lockOwner && (
            <Box
              sx={{
                mt: 2,
                pt: 1.5,
                borderTop: 1,
                borderColor: surface.border,
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: 13,
              }}
            >
              <LockIcon
                fontSize="small"
                sx={{ color: lockedByOther ? "error.light" : "text.secondary" }}
              />
              <Box component="span" sx={{ fontWeight: 500 }}>
                {lockOwner.name}
              </Box>
              <Box component="span" sx={{ color: "text.secondary", fontFamily: monoFont }}>
                {t("serverControl.since", { time: lockOwner.since })}
              </Box>
              {lockedByOther && (
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<LockOpenIcon />}
                  onClick={onReleaseLock}
                  disabled={!cloudSyncEnabled}
                  sx={{ ml: "auto", borderColor: surface.border }}
                >
                  {t("serverControl.releaseLock")}
                </Button>
              )}
            </Box>
          )}
        </Paper>
      )}
    </Stack>
  );
};
