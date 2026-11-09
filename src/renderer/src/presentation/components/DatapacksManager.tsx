import React from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Typography } from "@mui/material";
import { DeleteOutline as DeleteIcon, FileUpload as FileUploadIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { monoFont, surface } from "@renderer/theme";
import type { DatapacksList } from "@preload/index.d";

interface DatapacksManagerProps {
  serverId: string;
  list: DatapacksList;
  /** Anything but stopped: changes apply on the next start */
  isRunning: boolean;
  onListChange: (list: DatapacksList) => void;
  onSaved: (message: string) => void;
}

const formatSize = (bytes: number): string =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const DatapacksManager: React.FC<DatapacksManagerProps> = ({
  serverId,
  list,
  isRunning,
  onListChange,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{
    severity: "success" | "warning";
    text: string;
    detail?: string;
  } | null>(null);

  const tk = (key: string, options?: Record<string, unknown>): string =>
    t(`editServer.datapacks.${key}`, options);

  const refresh = async (): Promise<void> =>
    onListChange(await window.modsAPI.listDatapacks(serverId));

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const runAdd = (filePaths?: string[]): Promise<void> =>
    run(async () => {
      const result = await window.modsAPI.addDatapacks(serverId, filePaths);
      if (result.canceled) return;
      const { added, rejected } = result;
      if (added.length === 0 && rejected.length === 0) return;
      setNotice({
        severity: rejected.length > 0 ? "warning" : "success",
        text: [
          added.length > 0 && tk("added", { count: added.length }),
          rejected.length > 0 && tk("rejected", { count: rejected.length }),
        ]
          .filter(Boolean)
          .join(" · "),
        detail: rejected.length > 0 ? rejected.join(", ") : undefined,
      });
      onSaved(
        `Datapacks updated: ${[
          added.length > 0 && `${added.length} added`,
          rejected.length > 0 && `${rejected.length} rejected`,
        ]
          .filter(Boolean)
          .join(", ")}`,
      );
    });

  const runRemove = (name: string): Promise<void> =>
    run(async () => {
      if (await window.modsAPI.removeDatapack(serverId, name))
        onSaved("Datapacks updated: 1 removed");
    });

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    const paths = Array.from(e.dataTransfer.files)
      .filter((f) => f.name.toLowerCase().endsWith(".zip"))
      .map((f) => window.modsAPI.getPathForFile(f))
      .filter(Boolean);
    if (paths.length > 0) runAdd(paths);
  };

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={handleDrop}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        mt: 0.5,
        p: 1.5,
        border: "1px dashed",
        borderColor: dragOver ? "primary.main" : surface.border,
        bgcolor: dragOver ? "rgba(45, 212, 191, 0.06)" : surface.panel,
        borderRadius: 1,
        transition: "border-color 150ms ease, background-color 150ms ease",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {tk("installed", { count: list.datapacks.length })}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={busy}
          onClick={() => runAdd()}
          startIcon={
            busy ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <FileUploadIcon fontSize="small" />
            )
          }
          sx={{ flexShrink: 0 }}
        >
          {tk("add")}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {tk("help")}
        {isRunning && ` ${tk("restartCaption")}`}
      </Typography>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)}>
          {notice.text}
          {notice.detail && (
            <Typography variant="caption" component="div" sx={{ fontFamily: monoFont }}>
              {notice.detail}
            </Typography>
          )}
        </Alert>
      )}
      {list.datapacks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: "center" }}>
          {tk("empty")}
        </Typography>
      ) : (
        <Box sx={{ "& > * + *": { borderTop: 1, borderColor: surface.subtleBorder } }}>
          {list.datapacks.map((pack) => (
            <Box key={pack.name} sx={{ py: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {pack.name}
                </Typography>
                {pack.description && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {pack.description}
                  </Typography>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {pack.isFolder ? tk("folder") : formatSize(pack.sizeBytes)}
              </Typography>
              <IconButton
                size="small"
                disabled={busy}
                aria-label={tk("removeAria", { name: pack.name })}
                onClick={() => runRemove(pack.name)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
