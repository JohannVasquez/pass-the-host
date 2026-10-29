import React from "react";
import { Alert, Button, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { monoFont } from "@renderer/theme";

type FolderInfo = { folder: string | null; isDefault: boolean };

export const ModsFolderSettings: React.FC = () => {
  const { t } = useTranslation();
  const [info, setInfo] = React.useState<FolderInfo | null>(null);

  React.useEffect(() => {
    void window.modsAPI.getSyncFolder().then(setInfo);
  }, []);

  const change = async (): Promise<void> => {
    if (await window.modsAPI.pickSyncFolder()) setInfo(await window.modsAPI.getSyncFolder());
  };
  const reset = async (): Promise<void> => setInfo(await window.modsAPI.resetSyncFolder());

  if (!info) return null;

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{t("p2p.modsFolder.title")}</Typography>
      {info.folder ? (
        <Tooltip title={info.folder}>
          <Typography
            variant="body2"
            sx={{ fontFamily: monoFont, wordBreak: "break-all" }}
          >
            {info.folder}
          </Typography>
        </Tooltip>
      ) : (
        <Alert severity="info">{t("p2p.modsFolder.notFound")}</Alert>
      )}
      {info.folder && info.isDefault && (
        <Typography variant="caption" color="text.secondary">
          {t("p2p.modsFolder.isDefault")}
        </Typography>
      )}
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={() => void change()}>
          {t("p2p.modsFolder.change")}
        </Button>
        {!info.isDefault && (
          <Button size="small" onClick={() => void reset()}>
            {t("p2p.modsFolder.useDefault")}
          </Button>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t("p2p.modsFolder.help")}
      </Typography>
    </Stack>
  );
};
