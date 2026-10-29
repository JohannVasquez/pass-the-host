import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutline as OkIcon,
  Computer as ClientIcon,
  DeleteOutline as DeleteIcon,
  Dns as ServerIcon,
  ErrorOutline as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Extension as ExtensionIcon,
  FileUpload as FileUploadIcon,
  Search as SearchIcon,
  SyncAlt as BothIcon,
  WarningAmber as WarningIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { monoFont, surface } from "@renderer/theme";
import type { ModsList } from "@preload/index.d";

type ModItem = ModsList["mods"][number];
type Group = "incompatible" | "warning" | "ok";
type Filter = "all" | Group;

const GROUPS: { id: Group; color: "error" | "warning" | "success"; Icon: typeof OkIcon }[] = [
  { id: "incompatible", color: "error", Icon: ErrorIcon },
  { id: "warning", color: "warning", Icon: WarningIcon },
  { id: "ok", color: "success", Icon: OkIcon },
];

const ENGINE_NAMES: Record<string, string> = {
  paper: "Paper",
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
  plugin: "Plugin",
};
const engineName = (id: string): string => ENGINE_NAMES[id] ?? id;

const SIDE_ICONS = { client: ClientIcon, server: ServerIcon, both: BothIcon };

const groupOf = (mod: ModItem): Group =>
  mod.compat.status === "error" ? "incompatible" : mod.compat.status === "warning" ? "warning" : "ok";

// Client-only mods left in mods/ can crash a dedicated server
const isClientInMods = (mod: ModItem): boolean =>
  mod.folder === "mods" && mod.compat.status === "warning" && mod.compat.reason === "client_only";

const displayName = (mod: ModItem): string => mod.metadata?.name || mod.fileName;

interface ModsManagerProps {
  serverId: string;
  list: ModsList;
  /** Anything but stopped: changes apply on the next start */
  isRunning: boolean;
  onListChange: (list: ModsList) => void;
  onSaved: (message: string) => void;
}

export const ModsManager: React.FC<ModsManagerProps> = ({
  serverId,
  list,
  isRunning,
  onListChange,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [collapsed, setCollapsed] = React.useState<Partial<Record<Group, boolean>>>({});
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{
    severity: "success" | "warning";
    text: string;
    detail?: string;
  } | null>(null);

  // "plugins" context picks the *_plugins variant of a key when it exists
  const context = list.folder === "plugins" ? "plugins" : undefined;
  const tk = (key: string, options?: Record<string, unknown>): string =>
    t(`editServer.mods.${key}`, { context, ...options });

  const engine = engineName(list.engine);
  const loaderVersion = list.loaderVersion
    ? list.engine === "forge"
      ? list.loaderVersion.replace(`${list.minecraftVersion}-`, "")
      : list.loaderVersion
    : null;
  const subtitle = `${[engine, loaderVersion].filter(Boolean).join(" ")} · Minecraft ${list.minecraftVersion}`;

  const refresh = async (): Promise<void> => onListChange(await window.modsAPI.list(serverId));

  const reasonOf = (mod: ModItem): string | null => {
    // Only called for rejected files: a wrong loader, or not a .jar at all
    const c = mod.compat;
    if (c.status === "error" && c.reason === "wrong_loader")
      return tk("reasonWrongLoader", { loader: c.loaders.map(engineName).join("/") });
    return tk("reasonNotAMod");
  };

  const runAdd = async (filePaths?: string[]): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await window.modsAPI.add(serverId, filePaths);
      if (result.canceled) return;
      const { added, replaced, rejected } = result;
      const parts = [
        added.length > 0 &&
          `${tk("added", { count: added.length })}${
            added.some((m) => m.folder === "client-mods")
              ? ` (${tk("addedClientOnly", { count: added.filter((m) => m.folder === "client-mods").length })})`
              : ""
          }`,
        replaced.length > 0 && tk("replaced", { count: replaced.length }),
        rejected.length > 0 &&
          `${tk("rejected", { count: rejected.length })}${
            reasonOf(rejected[0]) ? `: ${reasonOf(rejected[0])}` : ""
          }`,
      ].filter(Boolean);
      if (parts.length > 0) {
        setNotice({
          severity: rejected.length > 0 ? "warning" : "success",
          text: parts.join(" · "),
          detail: rejected.length > 1 ? rejected.map((m) => m.fileName).join(", ") : undefined,
        });
        const summary = [
          added.length > 0 && `${added.length} added`,
          replaced.length > 0 && `${replaced.length} replaced`,
          rejected.length > 0 && `${rejected.length} rejected`,
        ].filter(Boolean);
        onSaved(`${list.folder === "plugins" ? "Plugins" : "Mods"} updated: ${summary.join(", ")}`);
      }
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<string | null>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const summary = await action();
      if (summary) onSaved(`${list.folder === "plugins" ? "Plugins" : "Mods"} updated: ${summary}`);
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const runRemove = (mod: ModItem): Promise<void> =>
    runAction(async () =>
      (await window.modsAPI.remove(serverId, mod.fileName, mod.folder)) ? "1 removed" : null,
    );

  const runMove = (mods: ModItem[], to: ModItem["folder"]): Promise<void> =>
    runAction(async () => {
      const moved = await window.modsAPI.move(
        serverId,
        mods.map((m) => m.fileName),
        mods[0].folder,
        to,
      );
      return moved > 0 ? `${moved} moved to ${to}` : null;
    });

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    const paths = Array.from(e.dataTransfer.files)
      .filter((f) => f.name.toLowerCase().endsWith(".jar"))
      .map((f) => window.modsAPI.getPathForFile(f))
      .filter(Boolean);
    if (paths.length > 0) runAdd(paths);
  };

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!busy) setDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
    },
    onDrop: handleDrop,
  };

  const chooseButton = (
    <Button
      variant="outlined"
      size="small"
      disabled={busy}
      onClick={() => runAdd()}
      startIcon={
        busy ? <CircularProgress size={14} color="inherit" /> : <FileUploadIcon fontSize="small" />
      }
      sx={{ flexShrink: 0 }}
    >
      {tk("chooseFiles")}
    </Button>
  );

  const dropSx = {
    border: "1px dashed",
    borderColor: dragOver ? "primary.main" : surface.border,
    bgcolor: dragOver ? "rgba(45, 212, 191, 0.06)" : surface.panel,
    borderRadius: 1,
    transition: "border-color 150ms ease, background-color 150ms ease",
  };

  const needle = query.trim().toLowerCase();
  const visible = list.mods.filter(
    (m) =>
      (filter === "all" || groupOf(m) === filter) &&
      (!needle ||
        [displayName(m), m.metadata?.id ?? "", m.fileName].some((s) =>
          s.toLowerCase().includes(needle),
        )),
  );

  const clientInMods = list.mods.filter(isClientInMods);

  const problemLine = (mod: ModItem): { error: boolean; text: string } | null => {
    const c = mod.compat;
    if (c.status === "ok") return null;
    if (c.status === "error") {
      const text =
        c.reason === "wrong_loader"
          ? tk("wrongLoader", {
              loaders: c.loaders.map(engineName).join("/"),
              engine: engineName(c.engine),
            })
          : tk("wrongMinecraft", { required: c.required, actual: c.actual });
      return { error: true, text };
    }
    const text =
      c.reason === "other_patch"
        ? tk("otherPatch", { required: c.required, actual: c.actual })
        : c.reason === "client_only"
          ? tk("clientOnly")
          : c.reason === "not_a_mod"
            ? tk("notAMod")
            : tk("unknownMinecraft");
    return { error: false, text };
  };

  const renderRow = (mod: ModItem): React.ReactNode => {
    const meta = mod.metadata;
    const problem = problemLine(mod);
    const name = displayName(mod);
    return (
      <Box
        key={mod.fileName}
        sx={{ px: 1.5, py: 1, display: "flex", flexDirection: "column", gap: 0.25 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {mod.modrinth ? (
            <Tooltip title={tk("openModrinth")}>
              <Box
                component="button"
                type="button"
                onClick={() => window.modsAPI.openModrinth(mod.modrinth!.slug)}
                sx={{
                  all: "unset",
                  boxSizing: "border-box",
                  flex: 1,
                  minWidth: 0,
                  cursor: "pointer",
                  typography: "body2",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  "&:hover": { textDecoration: "underline" },
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
                }}
              >
                {name}
              </Box>
            </Tooltip>
          ) : (
            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
              {name}
            </Typography>
          )}
          {meta?.version && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ fontFamily: monoFont, maxWidth: 140 }}
            >
              {meta.version}
            </Typography>
          )}
          {mod.folder === "client-mods" && (
            <Button size="small" disabled={busy} onClick={() => runMove([mod], "mods")}>
              {tk("moveToServer")}
            </Button>
          )}
          {isClientInMods(mod) && (
            <Button size="small" disabled={busy} onClick={() => runMove([mod], "client-mods")}>
              {tk("moveToClient")}
            </Button>
          )}
          <IconButton
            size="small"
            disabled={busy}
            aria-label={tk("removeAria", { name })}
            onClick={() => runRemove(mod)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
        {meta && (
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: monoFont }}
            >
              {meta.id}
            </Typography>
            {meta.loaders.map((l) => (
              <Chip key={l} size="small" variant="outlined" label={engineName(l)} />
            ))}
            {list.folder !== "plugins" && (
              <Tooltip title={tk(mod.sideSource === "modrinth" ? "sideModrinth" : "sideJar")}>
                <Chip
                  size="small"
                  variant="outlined"
                  icon={React.createElement(SIDE_ICONS[mod.side], { sx: { fontSize: 14 } })}
                  label={tk(`side.${mod.side}`)}
                  sx={{ color: "text.secondary", borderColor: "divider" }}
                />
              </Tooltip>
            )}
            {meta.minecraft && (
              <Typography variant="caption" color="text.secondary">
                {t("editServer.mods.minecraft", { version: meta.minecraft })}
              </Typography>
            )}
            {mod.folder === "client-mods" && (
              <Typography variant="caption" color="text.secondary">
                {tk("clientStored")}
              </Typography>
            )}
          </Box>
        )}
        {problem && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              color: problem.error ? "error.main" : "warning.main",
            }}
          >
            {problem.error ? <ErrorIcon sx={{ fontSize: 14 }} /> : <WarningIcon sx={{ fontSize: 14 }} />}
            <Typography variant="caption">{problem.text}</Typography>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoFont }}>
          {subtitle}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
          {tk("installed", { count: list.mods.length })}
          {list.folder !== "plugins" && (
            <Tooltip title={tk("forPlayersTip")}>
              <span>
                {" · "}
                {tk("forPlayers", {
                  count: list.mods.filter((m) => m.side !== "server").length,
                })}
              </span>
            </Tooltip>
          )}
        </Typography>
      </Box>
      {isRunning && (
        <Typography variant="caption" color="text.secondary">
          {t("editServer.mods.restartCaption")}
        </Typography>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)}>
          {notice.detail ? (
            <Tooltip title={notice.detail}>
              <span>{notice.text}</span>
            </Tooltip>
          ) : (
            notice.text
          )}
          {notice.detail && (
            <Typography variant="caption" component="div" sx={{ fontFamily: monoFont }}>
              {notice.detail}
            </Typography>
          )}
        </Alert>
      )}
      {list.mods.length === 0 ? (
        <Box
          {...dropProps}
          sx={{
            ...dropSx,
            py: 4,
            px: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}
        >
          <ExtensionIcon sx={{ color: "text.secondary" }} />
          <Typography variant="body2" fontWeight={600}>
            {tk("emptyTitle")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {tk("dropHint")} <Box component="span" sx={{ fontFamily: monoFont }}>.jar</Box>
          </Typography>
          {chooseButton}
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder={tk("search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                htmlInput: { "aria-label": tk("search") },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              select
              size="small"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              sx={{ minWidth: 150 }}
              slotProps={{ htmlInput: { "aria-label": t("editServer.mods.filter.label") } }}
            >
              {(["all", "incompatible", "warning", "ok"] as const).map((f) => (
                <MenuItem key={f} value={f}>
                  {t(`editServer.mods.filter.${f}`)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box
            {...dropProps}
            sx={{
              ...dropSx,
              px: 1.5,
              py: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {tk("dropHere")}
            </Typography>
            {chooseButton}
          </Box>
          {visible.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {t("editServer.mods.noResults")}
            </Typography>
          )}
          {GROUPS.map(({ id, color, Icon }) => {
            const items = visible
              .filter((m) => groupOf(m) === id)
              .sort((a, b) => displayName(a).localeCompare(displayName(b)));
            if (items.length === 0) return null;
            const isOpen = !collapsed[id];
            return (
              <Paper key={id} variant="outlined" sx={{ bgcolor: surface.panel, overflow: "hidden" }}>
                <Box
                  component="button"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setCollapsed((prev) => ({ ...prev, [id]: isOpen }))}
                  sx={{
                    all: "unset",
                    boxSizing: "border-box",
                    width: "100%",
                    px: 1.5,
                    py: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    cursor: "pointer",
                    color: `${color}.main`,
                    "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
                  }}
                >
                  <Icon fontSize="small" />
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                    {t(`editServer.mods.groups.${id}`, { count: items.length })}
                  </Typography>
                  <ExpandMoreIcon
                    fontSize="small"
                    sx={{ transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform 150ms" }}
                  />
                </Box>
                <Collapse in={isOpen}>
                  {id === "warning" && clientInMods.length > 0 && (
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        borderTop: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="caption" sx={{ flex: 1 }}>
                        {tk("clientOnlyBanner", { count: clientInMods.length })}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        disabled={busy}
                        onClick={() => runMove(clientInMods, "client-mods")}
                      >
                        {tk("moveToClient")}
                      </Button>
                    </Box>
                  )}
                  <Box
                    sx={{
                      borderTop: 1,
                      borderColor: "divider",
                      "& > * + *": { borderTop: 1, borderColor: surface.subtleBorder },
                    }}
                  >
                    {items.map(renderRow)}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </>
      )}
    </Box>
  );
};
