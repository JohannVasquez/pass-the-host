import React from "react";
import { Box, Paper, Typography, List, ListItem, ListItemText } from "@mui/material";
import { LogEntry } from "../../domain/entities/LogEntry";

interface ServerConsoleProps {
  logs: LogEntry[];
}

export const ServerConsole: React.FC<ServerConsoleProps> = ({ logs }): React.JSX.Element => {
  const consoleRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: LogEntry["type"]): string => {
    switch (type) {
      case "error":
        return "#ff5252";
      case "warning":
        return "#ffb74d";
      case "info":
      default:
        return "#e0e0e0";
    }
  };

  return (
    <Paper elevation={2} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6">Consola del Servidor</Typography>
      </Box>
      <Box
        ref={consoleRef}
        sx={{
          flex: 1,
          overflow: "auto",
          bgcolor: "#1e1e1e",
          p: 2,
          fontFamily: "monospace",
        }}
      >
        <List dense disablePadding>
          {logs.map((log, index) => (
            <ListItem key={index} disablePadding sx={{ mb: 0.5 }}>
              <ListItemText
                primary={
                  <Box component="span" sx={{ display: "flex", gap: 1 }}>
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ color: "#808080", minWidth: 80 }}
                    >
                      [{log.timestamp.toLocaleTimeString()}]
                    </Typography>
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ color: getLogColor(log.type), wordBreak: "break-word" }}
                    >
                      {log.message}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Paper>
  );
};
