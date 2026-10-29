import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTranslation } from "react-i18next";
import { monoFont, surface } from "@renderer/theme";
import type { ClientMod, ClientModManifest, SyncPlan } from "@preload/index.d";
import type { JoinedServer } from "@contexts/p2p-tunnel/infrastructure/PeerTunnel";

const MODRINTH_PARALLEL = 4;
const LOADER_NAMES: Record<string, string> = {
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};

interface ModSyncCardProps {
  groupId: string;
  tunnel: JoinedServer;
  onLog: (message: string, type: "info" | "success" | "warning" | "error") => void;
}

type Failure = { name: string };

/** C:\Users\me\...\mods → …\Users\me\...\mods keeps the end, where the instance is named */
const shortPath = (path: string): string => (path.length > 38 ? `…${path.slice(-37)}` : path);

export const ModSyncCard: React.FC<ModSyncCardProps> = ({ groupId, tunnel, onLog }) => {
  const { t } = useTranslation();
  const [manifest, setManifest] = React.useState<ClientModManifest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [folder, setFolder] = React.useState<string | null>(null);
  const [plan, setPlan] = React.useState<SyncPlan | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0, name: "" });
  const [failures, setFailures] = React.useState<Failure[]>([]);
  const aliveRef = React.useRef(true);
  const onLogRef = React.useRef(onLog);
  onLogRef.current = onLog;

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const key = manifest ? `${groupId}:${manifest.serverName}` : null;

  const replan = React.useCallback(
    async (nextManifest: ClientModManifest): Promise<void> => {
      const nextKey = `${groupId}:${nextManifest.serverName}`;
      const remembered = await window.modsAPI.getSyncFolder(nextKey);
      if (!aliveRef.current) return;
      setFolder(remembered);
      setPlan(remembered ? await window.modsAPI.planSync(nextKey, nextManifest) : null);
    },
    [groupId],
  );

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setFailures([]);
    try {
      const next = await tunnel.mods().manifest();
      if (!aliveRef.current) return;
      setManifest(next);
      if (next.mods.length > 0) await replan(next);
    } catch (e) {
      if (!aliveRef.current) return;
      const code = e instanceof Error ? e.message : "";
      setError(code === "mods_timeout" ? "noHost" : "network");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [tunnel, replan]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pickFolder = async (): Promise<void> => {
    if (!key || !manifest) return;
    try {
      if (await window.modsAPI.pickSyncFolder(key)) await replan(manifest);
    } catch {
      setError("network");
    }
  };

  const sync = async (): Promise<void> => {
    if (!key || !manifest || !plan) return;
    const queue = [...plan.download];
    const failed: Failure[] = [];
    let done = 0;
    setSyncing(true);
    setFailures([]);
    setProgress({ done: 0, total: queue.length, name: "" });
    onLogRef.current(`Syncing ${queue.length} mods from ${manifest.serverName}`, "info");
    const step = async (mod: ClientMod): Promise<void> => {
      setProgress((p) => ({ ...p, name: mod.name }));
      try {
        if (mod.url) await window.modsAPI.downloadModrinthMod(key, mod);
        else
          await window.modsAPI.writeSyncedMod(
            key,
            mod,
            await tunnel.mods().file(mod.sha1, mod.size),
          );
      } catch {
        failed.push({ name: mod.name });
      }
      done += 1;
      setProgress((p) => ({ ...p, done }));
    };
    try {
      const direct = queue.filter((mod) => mod.url);
      const viaHost = queue.filter((mod) => !mod.url);
      const worker = async (): Promise<void> => {
        for (let mod = direct.shift(); mod; mod = direct.shift()) await step(mod);
      };
      const hostWorker = async (): Promise<void> => {
        for (const mod of viaHost) await step(mod);
      };
      await Promise.all([...Array.from({ length: MODRINTH_PARALLEL }, worker), hostWorker()]);
      const { removed } = await window.modsAPI.finishSync(key, manifest);
      onLogRef.current(
        `Mods synced: ${queue.length - failed.length} downloaded, ${removed} removed${
          failed.length ? `, ${failed.length} failed` : ""
        }`,
        failed.length ? "warning" : "success",
      );
      if (!aliveRef.current) return;
      setFailures(failed);
      await replan(manifest);
    } catch (e) {
      onLogRef.current(`Mod sync failed: ${e instanceof Error ? e.message : String(e)}`, "error");
      if (aliveRef.current) setError("network");
    } finally {
      if (aliveRef.current) setSyncing(false);
    }
  };

  if (loading && !manifest)
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">
          {t("p2p.modSync.checking")}
        </Typography>
      </Stack>
    );

  if (error)
    return (
      <Alert
        severity="warning"
        sx={{ mb: 1, py: 0.5 }}
        action={
          <Button color="inherit" size="small" onClick={() => void load()}>
            {t("p2p.modSync.retry")}
          </Button>
        }
      >
        {t(`p2p.modSync.error.${error}`)}
      </Alert>
    );

  if (!manifest || manifest.mods.length === 0) return null;

  const loader = LOADER_NAMES[manifest.engine] ?? manifest.engine;
  // Forge reports a maven id such as 1.20.1-47.4.28: show only the loader part
  const loaderVersion = manifest.loaderVersion?.replace(`${manifest.minecraftVersion}-`, "");
  const loaderLabel = loaderVersion ? `${loader} ${loaderVersion}` : loader;
  const pending = plan ? plan.download.length : 0;
  const removing = plan ? plan.remove.length : 0;
  const busy = syncing || loading;

  return (
    <Box
      sx={{
        mb: 1,
        p: 1.5,
        borderRadius: 1,
        bgcolor: surface.base,
        border: 1,
        borderColor: surface.border,
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {manifest.serverName} · {loaderLabel} · Minecraft {manifest.minecraftVersion}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("p2p.modSync.count", { count: manifest.mods.length })}
          </Typography>
        </Box>
        <Tooltip title={t("p2p.modSync.refresh")}>
          <span>
            <IconButton
              size="small"
              onClick={() => void load()}
              disabled={busy}
              aria-label={t("p2p.modSync.refresh")}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        {t("p2p.modSync.needs", { loader: loaderLabel, mc: manifest.minecraftVersion })}
      </Typography>

      {folder ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
          <Tooltip title={folder}>
            <Typography noWrap variant="caption" sx={{ fontFamily: monoFont, flexGrow: 1 }}>
              {shortPath(folder)}
            </Typography>
          </Tooltip>
          <Button size="small" onClick={() => void pickFolder()} disabled={busy}>
            {t("p2p.modSync.changeFolder")}
          </Button>
        </Stack>
      ) : (
        <Box sx={{ mt: 1 }}>
          <Button
            fullWidth
            variant="contained"
            size="small"
            onClick={() => void pickFolder()}
            disabled={busy}
          >
            {t("p2p.modSync.pickFolder")}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {t("p2p.modSync.folderHint")}
          </Typography>
        </Box>
      )}

      {plan && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            {t("p2p.modSync.plan", {
              download: pending,
              upToDate: plan.upToDate,
              remove: removing,
            })}
          </Typography>
          {syncing ? (
            <>
              <LinearProgress
                variant="determinate"
                value={progress.total ? (progress.done / progress.total) * 100 : 0}
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-label={t("p2p.modSync.progressLabel")}
              />
              <Typography noWrap variant="caption" sx={{ display: "block", mt: 0.5 }}>
                {t("p2p.modSync.downloading", {
                  done: progress.done,
                  total: progress.total,
                  name: progress.name,
                })}
              </Typography>
            </>
          ) : pending === 0 && removing === 0 ? (
            <Alert severity="success" sx={{ py: 0 }}>
              {t("p2p.modSync.upToDate")}
            </Alert>
          ) : (
            <Button
              fullWidth
              variant="contained"
              size="small"
              onClick={() => void sync()}
              disabled={busy}
            >
              {t("p2p.modSync.sync")}
            </Button>
          )}
        </Box>
      )}

      {failures.length > 0 && (
        <Tooltip title={failures.map((f) => f.name).join(", ")}>
          <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
            {t("p2p.modSync.failed", { count: failures.length })}
          </Alert>
        </Tooltip>
      )}
    </Box>
  );
};
