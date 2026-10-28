import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Switch,
  MenuItem,
  Paper,
  CircularProgress,
  Divider,
  Chip,
  Avatar,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  Tune as TuneIcon,
  PersonAdd as PersonAddIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  Autorenew as AutorenewIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

type Field =
  | { key: string; type: "select"; options: string[] }
  | { key: string; type: "boolean" | "text" | "number" | "locked" };

// Keys not listed here still show up under "other", typed by their current value
const SECTIONS: { id: string; fields: Field[] }[] = [
  {
    id: "general",
    fields: [
      { key: "motd", type: "text" },
      { key: "max-players", type: "number" },
      { key: "online-mode", type: "boolean" },
      { key: "white-list", type: "boolean" },
      { key: "enforce-whitelist", type: "boolean" },
    ],
  },
  {
    id: "gameplay",
    fields: [
      {
        key: "gamemode",
        type: "select",
        options: ["survival", "creative", "adventure", "spectator"],
      },
      { key: "difficulty", type: "select", options: ["peaceful", "easy", "normal", "hard"] },
      { key: "hardcore", type: "boolean" },
      { key: "pvp", type: "boolean" },
      { key: "force-gamemode", type: "boolean" },
      { key: "allow-flight", type: "boolean" },
      { key: "enable-command-block", type: "boolean" },
      { key: "spawn-protection", type: "number" },
    ],
  },
  {
    id: "world",
    fields: [
      { key: "level-name", type: "text" },
      { key: "level-seed", type: "text" },
      {
        key: "level-type",
        type: "select",
        options: [
          "minecraft:normal",
          "minecraft:flat",
          "minecraft:large_biomes",
          "minecraft:amplified",
          "minecraft:single_biome_surface",
        ],
      },
      { key: "generate-structures", type: "boolean" },
      { key: "allow-nether", type: "boolean" },
      { key: "spawn-monsters", type: "boolean" },
      { key: "spawn-animals", type: "boolean" },
      { key: "spawn-npcs", type: "boolean" },
      { key: "view-distance", type: "number" },
      { key: "simulation-distance", type: "number" },
      { key: "max-world-size", type: "number" },
    ],
  },
  {
    id: "network",
    fields: [
      { key: "server-ip", type: "locked" },
      { key: "server-port", type: "locked" },
    ],
  },
];

const KNOWN_KEYS = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));

// Vanilla defaults, used for keys the file doesn't contain yet (e.g. before the first start)
const DEFAULTS: Record<string, string> = {
  motd: "A Minecraft Server",
  "max-players": "20",
  "online-mode": "true",
  "white-list": "false",
  "enforce-whitelist": "false",
  gamemode: "survival",
  difficulty: "easy",
  hardcore: "false",
  pvp: "true",
  "force-gamemode": "false",
  "allow-flight": "false",
  "enable-command-block": "false",
  "spawn-protection": "16",
  "level-name": "world",
  "level-seed": "",
  "level-type": "minecraft:normal",
  "generate-structures": "true",
  "allow-nether": "true",
  "spawn-monsters": "true",
  "spawn-animals": "true",
  "spawn-npcs": "true",
  "view-distance": "10",
  "simulation-distance": "10",
  "max-world-size": "29999984",
  "server-ip": "",
  "server-port": "25565",
};

const NUMBER_PATTERN = /^-?\d+$/;

// Only read when a world is generated, so changing them offers to regenerate it
const WORLD_GEN_KEYS = ["level-name", "level-seed", "level-type", "generate-structures"];

type WorldAction = "import" | "export" | "reset";

interface WhitelistEntry {
  uuid: string;
  name: string;
}

const WhitelistEditor: React.FC<{
  entries: WhitelistEntry[];
  onlineMode: boolean;
  onChange: (entries: WhitelistEntry[]) => void;
}> = ({ entries, onlineMode, onChange }) => {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [isLooking, setIsLooking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAdd = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed || isLooking) return;
    if (entries.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(t("editServer.whitelist.duplicate"));
      return;
    }
    setIsLooking(true);
    try {
      // ponytail: UUID kind follows online-mode at add time; re-add players if you flip it later
      const entry = await window.serverAPI.lookupPlayer(trimmed, onlineMode);
      if (!entry) {
        setError(t("editServer.whitelist.notFound", { name: trimmed }));
        return;
      }
      onChange([...entries, entry]);
      setName("");
    } catch {
      setError(t("editServer.whitelist.lookupError"));
    } finally {
      setIsLooking(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="body2" fontWeight={500}>
        {t("editServer.whitelist.title", { count: entries.length })}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <TextField
          size="small"
          fullWidth
          placeholder={t("editServer.whitelist.placeholder")}
          value={name}
          error={!!error}
          helperText={error ?? undefined}
          disabled={isLooking}
          slotProps={{ htmlInput: { maxLength: 16 } }}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!name.trim() || isLooking}
          startIcon={isLooking ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
          sx={{ flexShrink: 0, height: 40 }}
        >
          {t("editServer.whitelist.add")}
        </Button>
      </Box>
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("editServer.whitelist.empty")}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {entries.map((entry) => (
            <Chip
              key={entry.uuid}
              label={entry.name}
              variant="outlined"
              onDelete={() => onChange(entries.filter((e) => e.uuid !== entry.uuid))}
              avatar={
                // Falls back to MUI's default person icon when the face can't load
                <Avatar
                  alt={entry.name}
                  src={`https://mc-heads.net/avatar/${entry.uuid}/64`}
                  variant="rounded"
                  slotProps={{ img: { style: { imageRendering: "pixelated" } } }}
                />
              }
            />
          ))}
        </Box>
      )}
    </Paper>
  );
};

interface EditServerModalProps {
  open: boolean;
  serverId: string | null;
  serverName?: string | null;
  /** Anything but stopped: world files are in use */
  isRunning: boolean;
  onClose: () => void;
  /** Files on disk changed (the message goes to the console) */
  onSaved: (message: string) => void;
}

export const EditServerModal: React.FC<EditServerModalProps> = ({
  open,
  serverId,
  serverName,
  isRunning,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [original, setOriginal] = React.useState<Record<string, string> | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileMissing, setFileMissing] = React.useState(false);
  const [whitelist, setWhitelist] = React.useState<WhitelistEntry[]>([]);
  const [originalWhitelist, setOriginalWhitelist] = React.useState<WhitelistEntry[]>([]);
  const [regenerate, setRegenerate] = React.useState(false);
  const [worldBusy, setWorldBusy] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"import" | "reset" | null>(null);
  const [notice, setNotice] = React.useState<{
    severity: "success" | "warning";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    if (!open || !serverId) return;
    setOriginal(null);
    setError(null);
    setRegenerate(false);
    setNotice(null);
    Promise.all([
      window.serverAPI.readProperties(serverId),
      window.serverAPI.readWhitelist(serverId),
    ])
      .then(([properties, players]) => {
        const merged = { ...DEFAULTS, ...properties };
        setFileMissing(Object.keys(properties).length === 0);
        setOriginal(merged);
        setValues(merged);
        setWhitelist(players);
        setOriginalWhitelist(players);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [open, serverId]);

  const changed = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => original?.[key] !== value),
  );
  const whitelistChanged = JSON.stringify(whitelist) !== JSON.stringify(originalWhitelist);
  const hasChanges = Object.keys(changed).length > 0 || whitelistChanged;
  const worldGenChanged = WORLD_GEN_KEYS.some((key) => key in changed);
  const invalidNumber = SECTIONS.some((s) =>
    s.fields.some(
      (f) => f.type === "number" && f.key in changed && !NUMBER_PATTERN.test(changed[f.key]),
    ),
  );

  const handleSave = async (): Promise<void> => {
    if (!serverId) return;
    setIsSaving(true);
    try {
      if (
        Object.keys(changed).length > 0 &&
        !(await window.serverAPI.writeProperties(serverId, changed))
      ) {
        setFileMissing(true);
        return;
      }
      if (whitelistChanged) {
        await window.serverAPI.writeWhitelist(serverId, whitelist);
        if (isRunning) {
          await window.serverAPI.sendCommand(serverId, "whitelist reload").catch(() => false);
        }
      }
      const resetWorld = regenerate && worldGenChanged && !isRunning;
      if (resetWorld) {
        // The old name too: a renamed world would otherwise stay behind in its folder
        await window.serverAPI.resetWorld(serverId, [
          original?.["level-name"] ?? "world",
          values["level-name"],
        ]);
      }
      onSaved(resetWorld ? "server.properties updated, world reset" : "server.properties updated");
      onClose();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setIsSaving(false);
    }
  };

  const runWorldAction = async (action: WorldAction): Promise<void> => {
    if (!serverId) return;
    setConfirmAction(null);
    setNotice(null);
    setWorldBusy(true);
    try {
      const result =
        action === "export"
          ? await window.serverAPI.exportWorld(serverId)
          : action === "import"
            ? await window.serverAPI.importWorld(serverId)
            : await window.serverAPI.resetWorld(serverId, [original?.["level-name"] ?? "world"]);
      if (result === "canceled") return;
      if (result !== "done") {
        setNotice({ severity: "warning", text: t(`editServer.world.${result}`) });
        return;
      }
      if (action === "export") {
        setNotice({ severity: "success", text: t("editServer.world.exported") });
        return;
      }
      onSaved(
        action === "import"
          ? "World imported"
          : "World reset, a new one is generated on the next start",
      );
      onClose();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setWorldBusy(false);
    }
  };

  const setValue = (key: string, value: string): void =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const label = (key: string): string => t(`editServer.fields.${key}`, { defaultValue: key });

  const renderField = (field: Field): React.ReactNode => {
    const value = values[field.key] ?? "";

    if (field.type === "boolean") {
      return (
        <Paper
          key={field.key}
          variant="outlined"
          sx={{
            px: 1.5,
            py: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            cursor: "pointer",
            borderColor: value === "true" ? "primary.main" : "divider",
            transition: "border-color 150ms ease",
          }}
          onClick={() => setValue(field.key, value === "true" ? "false" : "true")}
        >
          <Typography variant="body2">{label(field.key)}</Typography>
          <Switch
            size="small"
            checked={value === "true"}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setValue(field.key, String(e.target.checked))}
            slotProps={{ input: { "aria-label": label(field.key) } }}
          />
        </Paper>
      );
    }

    if (field.type === "select") {
      const options =
        field.options.includes(value) || !value ? field.options : [value, ...field.options];
      return (
        <TextField
          key={field.key}
          select
          size="small"
          label={label(field.key)}
          value={value}
          onChange={(e) => setValue(field.key, e.target.value)}
        >
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {/* nsSeparator: values like "minecraft:normal" contain i18next's namespace separator */}
              {t(`editServer.options.${option}`, { defaultValue: option, nsSeparator: false })}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    const isNumber = field.type === "number";
    const numberError = isNumber && value !== "" && !NUMBER_PATTERN.test(value);
    return (
      <TextField
        key={field.key}
        size="small"
        label={label(field.key)}
        value={value}
        type={isNumber ? "number" : "text"}
        disabled={field.type === "locked"}
        error={numberError}
        helperText={field.type === "locked" ? t("editServer.lockedHint") : undefined}
        onChange={(e) => setValue(field.key, e.target.value)}
      />
    );
  };

  const otherFields: Field[] = Object.keys(original ?? {})
    .filter((key) => !KNOWN_KEYS.has(key))
    .sort()
    .map((key) => ({
      key,
      type: original?.[key] === "true" || original?.[key] === "false" ? "boolean" : "text",
    }));

  const sections = [...SECTIONS, { id: "other", fields: otherFields }].filter(
    (s) => s.fields.length > 0,
  );

  const renderWorldTools = (): React.ReactNode => {
    const disabled = isRunning || worldBusy || isSaving;
    return (
      <>
        {worldGenChanged && (
          <Alert severity="info" icon={false}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={regenerate}
                  disabled={isRunning}
                  onChange={(e) => setRegenerate(e.target.checked)}
                />
              }
              label={t("editServer.world.regenerateOnSave")}
            />
            <Typography variant="caption" component="div" color="text.secondary">
              {t("editServer.world.genHint")}
            </Typography>
          </Alert>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileUploadIcon />}
            disabled={disabled}
            onClick={() => setConfirmAction("import")}
          >
            {t("editServer.world.import")}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon />}
            disabled={disabled}
            onClick={() => runWorldAction("export")}
          >
            {t("editServer.world.export")}
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<AutorenewIcon />}
            disabled={disabled}
            onClick={() => setConfirmAction("reset")}
          >
            {t("editServer.world.reset")}
          </Button>
          {worldBusy && <CircularProgress size={20} />}
          {isRunning && (
            <Typography variant="caption" color="text.secondary">
              {t("editServer.world.stopFirst")}
            </Typography>
          )}
        </Box>
        {notice && (
          <Alert severity={notice.severity} onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}
      </>
    );
  };

  const renderSection = (id: string, fields: Field[]): React.ReactNode => {
    const toggles = fields.filter((f) => f.type === "boolean");
    const inputs = fields.filter((f) => f.type !== "boolean");
    return (
      <Box key={id}>
        <Typography variant="overline" color="text.secondary">
          {t(`editServer.sections.${id}`)}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 0.5 }}>
          {inputs.length > 0 && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
                pt: 0.5,
              }}
            >
              {inputs.map(renderField)}
            </Box>
          )}
          {id === "world" && renderWorldTools()}
          {toggles.length > 0 && (
            <Box
              sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}
            >
              {toggles.map(renderField)}
            </Box>
          )}
          {id === "general" && values["white-list"] === "true" && (
            <WhitelistEditor
              entries={whitelist}
              onlineMode={values["online-mode"] !== "false"}
              onChange={setWhitelist}
            />
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={isSaving || worldBusy ? undefined : onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TuneIcon color="primary" />
          {t("editServer.title")}
          <Typography component="span" color="text.secondary" sx={{ ml: 0.5 }}>
            {serverName ?? serverId}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {isRunning && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t("editServer.restartHint")}
          </Alert>
        )}
        {!original && !error ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : fileMissing ? (
          <Alert severity="warning">{t("editServer.noFile")}</Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sections.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && <Divider />}
                {renderSection(s.id, s.fields)}
              </React.Fragment>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={isSaving || worldBusy}>
          {t("editServer.cancel")}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasChanges || invalidNumber || isSaving || worldBusy}
        >
          {isSaving ? <CircularProgress size={20} color="inherit" /> : t("editServer.save")}
        </Button>
      </DialogActions>
      <Dialog open={confirmAction !== null} onClose={() => setConfirmAction(null)} maxWidth="xs">
        <DialogTitle>{confirmAction && t(`editServer.world.${confirmAction}`)}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirmAction && t(`editServer.world.confirm_${confirmAction}`)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} color="inherit">
            {t("editServer.cancel")}
          </Button>
          <Button
            variant="contained"
            color={confirmAction === "reset" ? "error" : "primary"}
            onClick={() => confirmAction && runWorldAction(confirmAction)}
          >
            {t("editServer.world.continue")}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};
