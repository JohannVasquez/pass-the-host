import React from "react";
import {
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
  Typography,
  GlobalStyles,
} from "@mui/material";
import { R2Configuration } from "./presentation/components/R2Configuration";
import { ServerControlPanel } from "./presentation/components/ServerControlPanel";
import { NetworkConfiguration } from "./presentation/components/NetworkConfiguration";
import { RamConfiguration } from "./presentation/components/RamConfiguration";
import { ServerConsole } from "./presentation/components/ServerConsole";
import { CommandInput } from "./presentation/components/CommandInput";
import { LanguageSwitcher } from "./presentation/components/LanguageSwitcher";
import { ServerStatus } from "./domain/entities/ServerStatus";
import { R2Config, RamConfig, NetworkInterface } from "./domain/entities/ServerConfig";
import { LogEntry } from "./domain/entities/LogEntry";
import "./i18n/config";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App(): React.JSX.Element {
  // Estados simulados para la interfaz
  const [serverStatus, setServerStatus] = React.useState<ServerStatus>(ServerStatus.STOPPED);
  const [r2Config, setR2Config] = React.useState<R2Config>({
    accountId: "",
    accessKeyId: "",
    secretAccessKey: "",
    bucketName: "",
  });
  const [ramConfig, setRamConfig] = React.useState<RamConfig>({
    min: 2,
    max: 4,
  });
  const [availableIps] = React.useState<NetworkInterface[]>([
    { name: "Ethernet", ip: "192.168.1.100" },
    { name: "Wi-Fi", ip: "192.168.1.101" },
    { name: "Localhost", ip: "127.0.0.1" },
  ]);
  const [selectedIp, setSelectedIp] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<LogEntry[]>([
    {
      timestamp: new Date(),
      message: "Minecraft Server - Server Manager v1.0",
      type: "info",
    },
    {
      timestamp: new Date(),
      message: "Waiting for configuration...",
      type: "info",
    },
  ]);

  // Simulated handlers (interface only)
  const handleSaveR2Config = (config: R2Config): void => {
    setR2Config(config);
    console.log("R2 Config saved:", config);
  };

  const handleStartStop = (): void => {
    if (serverStatus === ServerStatus.STOPPED) {
      setServerStatus(ServerStatus.STARTING);
      setTimeout(() => setServerStatus(ServerStatus.RUNNING), 2000);
    } else if (serverStatus === ServerStatus.RUNNING) {
      setServerStatus(ServerStatus.STOPPING);
      setTimeout(() => setServerStatus(ServerStatus.STOPPED), 2000);
    }
  };

  const handleReleaseLock = (): void => {
    console.log("Lock released");
  };

  const handleSyncToR2 = (): void => {
    console.log("Syncing to R2...");
  };

  const handleEditProperties = (): void => {
    console.log("Opening server.properties editor");
  };

  const handleExecuteCommand = (command: string): void => {
    const newLog: LogEntry = {
      timestamp: new Date(),
      message: `> ${command}`,
      type: "info",
    };
    setLogs([...logs, newLog]);
    console.log("Command executed:", command);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            margin: 0,
            padding: 0,
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
          },
          "#root": {
            width: "100%",
            height: "100%",
            display: "flex",
          },
        }}
      />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          width: "100%",
          overflow: "hidden",
          bgcolor: "background.default",
        }}
      >
        {/* App Bar with Language Switcher */}
        <AppBar position="static" elevation={1}>
          <Toolbar variant="dense">
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Minecraft Server Manager
            </Typography>
            <LanguageSwitcher />
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Box
          sx={{
            display: "flex",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* Panel Izquierdo - Configuraciones */}
          <Box
            sx={{
              width: { xs: "100%", md: 400 },
              minWidth: 350,
              maxWidth: 450,
              p: 2,
              overflow: "auto",
              borderRight: 1,
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              flexShrink: 0,
            }}
          >
            <ServerControlPanel
              status={serverStatus}
              onStartStop={handleStartStop}
              onReleaseLock={handleReleaseLock}
              onSyncToR2={handleSyncToR2}
              onEditProperties={handleEditProperties}
            />

            <R2Configuration config={r2Config} onSave={handleSaveR2Config} />

            <NetworkConfiguration
              availableIps={availableIps}
              selectedIp={selectedIp}
              onSelectIp={setSelectedIp}
            />

            <RamConfiguration ramConfig={ramConfig} onChange={setRamConfig} />
          </Box>

          {/* Panel Derecho - Consola y Comandos */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                flex: 1,
                p: 2,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ServerConsole logs={logs} />
            </Box>

            <Box
              sx={{
                p: 2,
                borderTop: 1,
                borderColor: "divider",
                flexShrink: 0,
              }}
            >
              <CommandInput onExecuteCommand={handleExecuteCommand} />
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
