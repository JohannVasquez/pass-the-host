import React from "react";
import { Box, Typography } from "@mui/material";
import TerminalIcon from "@mui/icons-material/Terminal";
import { useTranslation } from "react-i18next";
import { monoFont, surface } from "@renderer/theme";
import { LogEntry } from "@renderer/domain/entities/LogEntry";

interface ServerConsoleProps {
  logs: LogEntry[];
}

const LOG_COLORS: Record<LogEntry["type"], string> = {
  info: "#c9ced8",
  success: "#4ade80",
  warning: "#f5a524",
  error: "#f87171",
};

export const ServerConsole: React.FC<ServerConsoleProps> = ({ logs }): React.JSX.Element => {
  const { t } = useTranslation();
  const consoleRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <>
      <Box
        sx={{
          height: 40,
          flexShrink: 0,
          px: 2,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom: 1,
          borderColor: surface.subtleBorder,
        }}
      >
        <TerminalIcon fontSize="small" sx={{ color: "text.secondary" }} />
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{t("console.title")}</Typography>
      </Box>
      <Box
        ref={consoleRef}
        sx={{
          flex: 1,
          overflow: "auto",
          px: 2,
          py: 1.5,
          fontFamily: monoFont,
          fontSize: 13,
          lineHeight: "22px",
          wordBreak: "break-word",
        }}
      >
        {logs.map((log, index) => (
          <Box key={index} sx={{ color: LOG_COLORS[log.type] }}>
            <Box component="span" sx={{ color: "#6b7383" }}>
              [{log.timestamp.toLocaleTimeString()}]
            </Box>{" "}
            {log.message}
          </Box>
        ))}
      </Box>
    </>
  );
};
