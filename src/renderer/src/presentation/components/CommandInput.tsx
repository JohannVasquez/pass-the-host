import React from "react";
import { Box, TextField, Button, Paper, Stack, Chip, Typography } from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
interface CommandInputProps {
  onExecuteCommand: (command: string) => void | Promise<void>;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  onExecuteCommand,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [command, setCommand] = React.useState("");

  const PRESET_COMMANDS = [
    { label: t("commands.presets.listPlayers"), command: "list" },
    { label: t("commands.presets.sayMessage"), command: "say " },
    { label: t("commands.presets.night"), command: "time set night" },
    { label: t("commands.presets.day"), command: "time set day" },
    { label: t("commands.presets.clearWeather"), command: "weather clear" },
  ];

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (command.trim()) {
      await onExecuteCommand(command);
      setCommand("");
    }
  };

  const handlePresetClick = async (presetCommand: string): Promise<void> => {
    if (presetCommand.endsWith(" ")) {
      setCommand(presetCommand);
    } else {
      await onExecuteCommand(presetCommand);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2, width: "100%" }}>
      <Typography variant="h6" gutterBottom>
        {t("commands.title")}
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t("commands.quickCommands")}:
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {PRESET_COMMANDS.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              onClick={() => handlePresetClick(preset.command)}
              clickable
              size="small"
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
      </Box>

      <form onSubmit={handleSubmit}>
        <Stack direction="row" spacing={1}>
          <TextField
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={t("commands.placeholder")}
            fullWidth
            size="small"
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="contained"
            endIcon={<SendIcon />}
            disabled={!command.trim()}
          >
            {t("commands.send")}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
};
