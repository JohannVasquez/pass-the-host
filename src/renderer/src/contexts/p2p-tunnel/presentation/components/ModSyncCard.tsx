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
  tunnel: JoinedServer;
  onLog: (message: string, type: "info" | "success" | "warning" | "error") => void;
  onOpenSettings?: () => void;
}

type Failure = { name: string };

/** C:\Users\me\...\mods → …\Users\me\...\mods keeps the end, where the instance is named */
const shortPath = (path: string): string => (path.length > 38 ? `…${path.slice(-37)}` : path);

export const ModSyncCard: React.FC<ModSyncCardProps> = ({ tunnel, onLog, onOpenSettings }) => {
  const { t } = useTranslation();
  const [manifest, setManifest] = React.useState<ClientModManifest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [folder, setFolder] = React.useState<string | null>(null);
  const [plan, setPlan] = React.useState<SyncPlan | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0, name: "" });
  const [failures, setFailures] = React.useState<Failure[]>([]);
  const [changed, setChanged] = React.useState(false);
  const aliveRef = React.useRef(true);
  const manifestRef = React.useRef<ClientModManifest | null>(null);
  manifestRef.current = manifest;

  const onLogRef = React.useRef(onLog);
  onLogRef.current = onLog;

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Reads the folder every time: it may have changed in Settings since the last plan
  const replan = React.useCallback(
    async (nextManifest: ClientModManifest): Promise<SyncPlan | null> => {
      const { folder: current } = await window.modsAPI.getSyncFolder();
      if (!aliveRef.current) return null;
      setFolder(current);
      const next = current ? await window.modsAPI.planSync(nextManifest) : null;
      if (aliveRef.current) setPlan(next);
      return next;
    },
    [],
  );

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setFailures([]);
    setChanged(false);
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

  // The host's mods changed while connected: refetch and replan (debounced), warn if anything is pending
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = tunnel.mods().onChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const next = await tunnel.mods().manifest();
          if (!aliveRef.current) return;
          setManifest(next);
          const nextPlan = await replan(next);
          if (!nextPlan || (nextPlan.download.length === 0 && nextPlan.remove.length === 0)) return;
          setChanged(true);
          onLogRef.current(
            `${next.serverName} changed the server's mods: sync to stay compatible`,
            "warning",
          );
          if (!document.hasFocus())
            void window.notificationAPI.show(
              t("p2p.modSync.notifyTitle", { server: next.serverName }),
              t("p2p.modSync.notifyBody"),
            );
        } catch {
          // The manual "Check again" button still works
        }
      }, 1000);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [tunnel, replan, t]);

  // Back from Settings: pick up a folder change without rejoining
  React.useEffect(() => {
    const onFocus = (): void => {
      if (manifestRef.current && manifestRef.current.mods.length > 0)
        void replan(manifestRef.current).catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [replan]);

  const sync = async (): Promise<void> => {
    if (!manifest || !plan || !folder) return;
    const queue = [...plan.download];
    const failed: Failure[] = [];
    let done = 0;
    setSyncing(true);
    setChanged(false);
    setFailures([]);
    setProgress({ done: 0, total: queue.length, name: "" });
    onLogRef.current(`Syncing ${queue.length} mods from ${manifest.serverName}`, "info");
    const step = async (mod: ClientMod): Promise<void> => {
      setProgress((p) => ({ ...p, name: mod.name }));
      try {
        if (mod.url) await window.modsAPI.downloadModrinthMod(mod);
        else
          await window.modsAPI.writeSyncedMod(mod, await tunnel.mods().file(mod.sha1, mod.size));
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
      const { removed } = await window.modsAPI.finishSync(manifest);
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
  const mismatch = pending > 0 || removing > 0;
  const summary = [
    pending > 0 && t("p2p.modSync.toDownload", { count: pending }),
    removing > 0 && t("p2p.modSync.toRemove", { count: removing }),
  ]
    .filter(Boolean)
    .join(" · ");
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
      {plan && mismatch && !syncing && (
        <Alert
          severity="warning"
          variant="filled"
          sx={{ mb: 1, py: 0.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => void sync()} disabled={busy}>
              {t("p2p.modSync.sync")}
            </Button>
          }
        >
          {t(changed ? "p2p.modSync.changedWarning" : "p2p.modSync.mismatchWarning", { summary })}
        </Alert>
      )}
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
            <Typography noWrap variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              {t("p2p.modSync.savedIn")}{" "}
              <Box component="span" sx={{ fontFamily: monoFont }}>
                {shortPath(folder)}
              </Box>
            </Typography>
          </Tooltip>
          {onOpenSettings && (
            <Button size="small" onClick={onOpenSettings} disabled={busy}>
              {t("p2p.modSync.change")}
            </Button>
          )}
        </Stack>
      ) : (
        <Alert
          severity="warning"
          sx={{ mt: 1, py: 0 }}
          action={
            onOpenSettings && (
              <Button color="inherit" size="small" onClick={onOpenSettings}>
                {t("p2p.modSync.openSettings")}
              </Button>
            )
          }
        >
          {t("p2p.modSync.noFolder")}
        </Alert>
      )}

      {/* A mismatch already shows its counts and the sync action in the warning above */}
      {plan && (syncing || !mismatch) && (
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
          ) : (
            <Alert severity="success" sx={{ py: 0 }}>
              {t("p2p.modSync.upToDate")}
            </Alert>
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
