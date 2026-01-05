import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  CircularProgress,
  Typography,
  LinearProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";

interface CreateServerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (serverName: string, version: string, serverType: "vanilla" | "forge") => void;
  isCreating?: boolean;
  progressMessage?: string;
}

const minecraftVersions = [
  "1.21.11",
  "1.21.10",
  "1.21.9",
  "1.21.8",
  "1.21.7",
  "1.21.6",
  "1.21.5",
  "1.21.4",
  "1.21.3",
  "1.21.1",
  "1.21",
  "1.20.6",
  "1.20.5",
  "1.20.4",
  "1.20.2",
  "1.20.1",
  "1.20",
  "1.19.4",
  "1.19.3",
  "1.19.2",
  "1.19.1",
  "1.19",
  "1.18.2",
  "1.18.1",
  "1.18",
  "1.17.1",
  "1.17",
  "1.16.5",
  "1.16.4",
  "1.16.3",
  "1.16.2",
  "1.16.1",
  "1.16",
  "1.15.2",
  "1.15.1",
  "1.15",
  "1.14.4",
  "1.14.3",
  "1.14.2",
  "1.14.1",
  "1.14",
  "1.13.2",
  "1.13.1",
  "1.13",
  "1.12.2",
  "1.12.1",
  "1.12",
  "1.11.2",
  "1.11.1",
  "1.11",
  "1.10.2",
  "1.10.1",
  "1.10",
  "1.9.4",
  "1.9.3",
  "1.9.2",
  "1.9.1",
  "1.9",
  "1.8.9",
  "1.8.8",
  "1.8.7",
  "1.8.6",
  "1.8.5",
  "1.8.4",
  "1.8.3",
  "1.8.2",
  "1.8.1",
  "1.8",
  "1.7.10",
];

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  open,
  onClose,
  onConfirm,
  isCreating = false,
  progressMessage = "",
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [serverName, setServerName] = React.useState<string>("");
  const [version, setVersion] = React.useState<string>(minecraftVersions[0]);
  const [serverType, setServerType] = React.useState<"vanilla" | "forge">("vanilla");
  const [nameError, setNameError] = React.useState<string>("");

  // If creating, show progress view
  if (isCreating) {
    return (
      <Dialog open={open} disableEscapeKeyDown maxWidth="sm" fullWidth>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 4,
              gap: 3,
            }}
          >
            <CircularProgress size={60} thickness={4} />
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              {t("createServer.creatingTitle")}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                textAlign: "center",
                minHeight: "24px",
              }}
            >
              {progressMessage || t("createServer.preparing")}
            </Typography>
            <Box sx={{ width: "100%", mt: 2 }}>
              <LinearProgress />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                textAlign: "center",
                mt: 1,
              }}
            >
              {t("createServer.modalWarning")}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // Minecraft versions (common versions)

  const handleServerNameChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;

    // Validate: no special characters, no spaces
    const validNameRegex = /^[a-zA-Z0-9_-]*$/;

    if (!validNameRegex.test(value)) {
      setNameError(t("createServer.invalidName"));
    } else if (value.length > 0 && value.length < 3) {
      setNameError(t("createServer.nameTooShort"));
    } else {
      setNameError("");
    }

    setServerName(value);
  };

  const handleConfirm = (): void => {
    if (serverName.trim() === "") {
      setNameError(t("createServer.nameRequired"));
      return;
    }

    if (serverName.length < 3) {
      setNameError(t("createServer.nameTooShort"));
      return;
    }

    if (nameError) {
      return;
    }

    onConfirm(serverName, version, serverType);
    handleClose();
  };

  const handleClose = (): void => {
    setServerName("");
    setVersion("1.21.4");
    setServerType("vanilla");
    setNameError("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("createServer.title")}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
          {/* Server Name */}
          <TextField
            label={t("createServer.serverName")}
            value={serverName}
            onChange={handleServerNameChange}
            error={!!nameError}
            helperText={nameError || t("createServer.nameHelp")}
            fullWidth
            autoFocus
          />

          {/* Server Type */}
          <FormControl component="fieldset">
            <FormLabel component="legend">{t("createServer.serverType")}</FormLabel>
            <RadioGroup
              row
              value={serverType}
              onChange={(e) => setServerType(e.target.value as "vanilla" | "forge")}
            >
              <FormControlLabel
                value="vanilla"
                control={<Radio />}
                label={t("createServer.vanilla")}
              />
              <FormControlLabel value="forge" control={<Radio />} label={t("createServer.forge")} />
            </RadioGroup>
          </FormControl>

          {/* Minecraft Version */}
          <FormControl fullWidth>
            <InputLabel>{t("createServer.version")}</InputLabel>
            <Select
              value={version}
              label={t("createServer.version")}
              onChange={(e) => setVersion(e.target.value)}
            >
              {minecraftVersions.map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Info Alert */}
          <Alert severity="info">{t("createServer.info")}</Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("createServer.cancel")}</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!!nameError || serverName.trim() === ""}
        >
          {t("createServer.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
