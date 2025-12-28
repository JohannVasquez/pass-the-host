import React from "react";
import { Box, TextField, Button, Paper, Stack, Chip, Typography } from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";

interface CommandInputProps {
  onExecuteCommand: (command: string) => void;
}

const PRESET_COMMANDS = [
  { label: "List Players", command: "list" },
  { label: "Say Message", command: "say " },
  { label: "Night", command: "time set night" },
  { label: "Day", command: "time set day" },
  { label: "Clear Weather", command: "weather clear" },
];

export const CommandInput: React.FC<CommandInputProps> = ({
  onExecuteCommand,
}): React.JSX.Element => {
  const [command, setCommand] = React.useState("");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (command.trim()) {
      onExecuteCommand(command);
      setCommand("");
    }
  };

  const handlePresetClick = (presetCommand: string): void => {
    if (presetCommand.endsWith(" ")) {
      setCommand(presetCommand);
    } else {
      onExecuteCommand(presetCommand);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Comandos
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Comandos Rápidos:
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
            placeholder="Ingresa un comando..."
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
            Enviar
          </Button>
        </Stack>
      </form>
    </Paper>
  );
};
