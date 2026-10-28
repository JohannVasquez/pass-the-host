import React from "react";
import { Box, Button, InputBase, Typography } from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { monoFont, surface } from "@renderer/theme";

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
    <>
      <Box
        sx={{
          minHeight: 48,
          flexShrink: 0,
          px: 1.5,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 0.5,
          borderTop: 1,
          borderColor: surface.subtleBorder,
        }}
      >
        <Typography sx={{ fontSize: 12, color: "text.secondary", mr: 1, pl: 0.5 }}>
          {t("commands.quickCommands")}
        </Typography>
        {PRESET_COMMANDS.map((preset) => (
          <Button
            key={preset.label}
            size="small"
            color="inherit"
            onClick={() => handlePresetClick(preset.command)}
            sx={{ color: "#b4bac6", fontWeight: 400, px: 1.5 }}
          >
            {preset.label}
          </Button>
        ))}
      </Box>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          height: 56,
          flexShrink: 0,
          px: 2,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderTop: 1,
          borderColor: surface.subtleBorder,
        }}
      >
        <Box
          sx={{
            flex: 1,
            height: 40,
            px: 1.5,
            display: "flex",
            alignItems: "center",
            borderRadius: 1,
            bgcolor: surface.panel,
            border: 1,
            borderColor: surface.border,
            "&:focus-within": { borderColor: "primary.main" },
          }}
        >
          <Box component="span" sx={{ color: "primary.main", fontFamily: monoFont, mr: 1 }}>
            &gt;
          </Box>
          <InputBase
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={t("commands.placeholder")}
            fullWidth
            autoComplete="off"
            inputProps={{ "aria-label": t("commands.placeholder") }}
            sx={{ fontFamily: monoFont, fontSize: 13 }}
          />
        </Box>
        <Button
          type="submit"
          variant="contained"
          endIcon={<SendIcon />}
          disabled={!command.trim()}
          sx={{
            flexShrink: 0,
            height: 40,
            bgcolor: "#eaeaea",
            color: surface.base,
            "&:hover": { bgcolor: "#ffffff" },
          }}
        >
          {t("commands.send")}
        </Button>
      </Box>
    </>
  );
};
