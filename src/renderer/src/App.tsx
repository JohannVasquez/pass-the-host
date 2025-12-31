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
import { UsernameInput } from "./presentation/components/UsernameInput";
import { ReleaseLockModal } from "./presentation/components/ReleaseLockModal";
import { ServerStatus } from "./domain/entities/ServerStatus";
import { R2Config, RamConfig, NetworkInterface } from "./domain/entities/ServerConfig";
import { LogEntry } from "./domain/entities/LogEntry";
import { Server } from "./domain/entities/Server";
import { R2ServerRepository } from "./infrastructure/repositories/R2ServerRepository";
import { R2Service } from "./infrastructure/services/R2Service";
import "./i18n/config";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App(): React.JSX.Element {
  // Estados simulados para la interfaz
  const [serverStatus, setServerStatus] = React.useState<ServerStatus>(ServerStatus.STOPPED);
  const [servers, setServers] = React.useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = React.useState<string | null>(null);
  const [isR2Configured, setIsR2Configured] = React.useState<boolean>(false);
  const [isRcloneReady, setIsRcloneReady] = React.useState<boolean>(false);
  const [rcloneCheckCompleted, setRcloneCheckCompleted] = React.useState<boolean>(false);
  const [configLoaded, setConfigLoaded] = React.useState<boolean>(false);
  const [r2Config, setR2Config] = React.useState<R2Config>({
    endpoint: "",
    access_key: "",
    secret_key: "",
    bucket_name: "",
  });
  const [ramConfig, setRamConfig] = React.useState<RamConfig>({
    min: 2,
    max: 4,
  });
  const [availableIps, setAvailableIps] = React.useState<NetworkInterface[]>([]);
  const [selectedIp, setSelectedIp] = React.useState<string | null>(null);
  const [username, setUsername] = React.useState<string>("");
  const [isReleaseLockModalOpen, setIsReleaseLockModalOpen] = React.useState<boolean>(false);
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

  // Load configuration from config.json on mount
  React.useEffect(() => {
    const loadConfig = async (): Promise<void> => {
      try {
        const config = await window.configAPI.loadConfig();

        if (!config) {
          throw new Error("Failed to load config");
        }

        // Parse memory values (e.g., "2G" -> 2)
        const memMin = parseInt(config.server.memory_min.replace(/[^0-9]/g, ""), 10);
        const memMax = parseInt(config.server.memory_max.replace(/[^0-9]/g, ""), 10);

        setR2Config({
          endpoint: config.r2.endpoint || "",
          access_key: config.r2.access_key || "",
          secret_key: config.r2.secret_key || "",
          bucket_name: config.r2.bucket_name || "",
        });

        setRamConfig({
          min: memMin,
          max: memMax,
        });

        // Load username
        setUsername(config.app?.owner_name || "");

        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Configuration loaded successfully",
            type: "info",
          },
        ]);
      } catch (error) {
        console.error("Error loading config:", error);
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Error loading configuration file",
            type: "error",
          },
        ]);
      } finally {
        setConfigLoaded(true);
      }
    };

    loadConfig();
  }, []);

  // Load network interfaces on mount
  React.useEffect(() => {
    const loadNetworkInterfaces = async (): Promise<void> => {
      try {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Loading network interfaces...",
            type: "info",
          },
        ]);

        const interfaces = await window.systemAPI.getNetworkInterfaces();
        setAvailableIps(interfaces);

        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Found ${interfaces.length} network interface(s)`,
            type: "info",
          },
        ]);
      } catch (error) {
        console.error("Error loading network interfaces:", error);
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Error loading network interfaces",
            type: "error",
          },
        ]);
      }
    };

    loadNetworkInterfaces();
  }, []);

  // Validate R2 configuration
  const validateR2Config = (config: R2Config): boolean => {
    return !!(
      config.endpoint &&
      config.access_key &&
      config.secret_key &&
      config.bucket_name &&
      config.endpoint !== "" &&
      config.access_key !== "" &&
      config.secret_key !== "" &&
      config.bucket_name !== ""
    );
  };

  // Check if rclone is installed and verify R2 connection
  React.useEffect(() => {
    // Wait for config to load first
    if (!configLoaded) {
      return;
    }

    // Prevent multiple executions
    if (rcloneCheckCompleted) {
      return;
    }

    const checkRcloneAndR2 = async (): Promise<void> => {
      try {
        // Check if rclone exists
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Checking rclone installation...",
            type: "info",
          },
        ]);

        const rcloneExists = await window.rclone.checkInstallation();

        if (!rcloneExists) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Rclone not found. Installing...",
              type: "warning",
            },
          ]);

          const installSuccess = await window.rclone.installRclone();

          if (!installSuccess) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Failed to install rclone. Please install manually.",
                type: "error",
              },
            ]);
            setIsRcloneReady(false);
            return;
          }

          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Rclone installed successfully",
              type: "info",
            },
          ]);
        } else {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Rclone is already installed",
              type: "info",
            },
          ]);
        }

        // If R2 is configured, test the connection

        if (validateR2Config(r2Config)) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Testing R2 connection...",
              type: "info",
            },
          ]);

          const connectionSuccess = await window.rclone.testR2Connection({
            endpoint: r2Config.endpoint,
            access_key: r2Config.access_key,
            secret_key: r2Config.secret_key,
            bucket_name: r2Config.bucket_name,
          });

          if (connectionSuccess) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "R2 connection successful",
                type: "info",
              },
            ]);
            setIsRcloneReady(true);

            // Load servers from R2
            loadServersFromR2();
          } else {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Failed to connect to R2. Please check your configuration.",
                type: "error",
              },
            ]);
            setIsRcloneReady(false);
          }
        } else {
          setIsRcloneReady(true); // Rclone is ready but R2 not configured yet
        }
      } catch (error) {
        console.error("Error checking rclone:", error);
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Error: ${error instanceof Error ? error.message : String(error)}`,
            type: "error",
          },
        ]);
        setIsRcloneReady(false);
      } finally {
        setRcloneCheckCompleted(true);
      }
    };

    checkRcloneAndR2();
  }, [configLoaded, rcloneCheckCompleted]);

  // Validate R2 configuration when it changes
  React.useEffect(() => {
    const isValid = validateR2Config(r2Config);
    setIsR2Configured(isValid);

    if (isValid && isRcloneReady) {
      // Re-test R2 connection when config changes
      const testConnection = async (): Promise<void> => {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "R2 configuration changed. Testing connection...",
            type: "info",
          },
        ]);

        const connectionSuccess = await window.rclone.testR2Connection({
          endpoint: r2Config.endpoint,
          access_key: r2Config.access_key,
          secret_key: r2Config.secret_key,
          bucket_name: r2Config.bucket_name,
        });

        if (connectionSuccess) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "R2 connection successful",
              type: "info",
            },
          ]);
        } else {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Failed to connect to R2. Please check your configuration.",
              type: "error",
            },
          ]);
          setIsRcloneReady(false);
        }
      };

      testConnection();
    }
  }, [r2Config, isRcloneReady]);

  // Load servers from R2
  const loadServersFromR2 = async (): Promise<void> => {
    if (!validateR2Config(r2Config)) {
      return;
    }

    try {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Loading servers from R2...",
          type: "info",
        },
      ]);

      const repository = new R2ServerRepository(r2Config);
      const serverList = await repository.getServers();

      setServers(serverList);

      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Found ${serverList.length} server(s) in R2`,
          type: "info",
        },
      ]);
    } catch (error) {
      console.error("Error loading servers from R2:", error);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Error loading servers from R2",
          type: "error",
        },
      ]);
    }
  };

  // Simulated handlers (interface only)
  const handleSaveR2Config = (config: R2Config): void => {
    setR2Config(config);
    console.log("R2 Config saved:", config);
  };

  const handleSaveUsername = async (newUsername: string): Promise<void> => {
    const success = await window.configAPI.saveUsername(newUsername);
    if (success) {
      setUsername(newUsername);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Username updated to: ${newUsername}`,
          type: "info",
        },
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Failed to save username",
          type: "error",
        },
      ]);
    }
  };

  const handleStartStop = async (): Promise<void> => {
    if (serverStatus === ServerStatus.STOPPED) {
      // Check if a server is selected
      if (!selectedServer) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Please select a server first",
            type: "error",
          },
        ]);
        return;
      }

      // Check if an IP is selected
      if (!selectedIp) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Please select a network IP address first",
            type: "error",
          },
        ]);
        return;
      }

      setServerStatus(ServerStatus.STARTING);

      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Starting server: ${selectedServer}`,
          type: "info",
        },
      ]);

      // Download server files from R2
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Downloading server files from R2...",
          type: "info",
        },
      ]);

      const r2Service = new R2Service(r2Config);
      const downloadSuccess = await r2Service.downloadServer(selectedServer);

      if (downloadSuccess) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Server files downloaded successfully",
            type: "info",
          },
        ]);

        // Create server lock file
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Creating server lock...",
            type: "info",
          },
        ]);

        const lockSuccess = await window.serverAPI.createLock(
          selectedServer,
          username || "Unknown"
        );

        if (lockSuccess) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: `Server locked by: ${username || "Unknown"}`,
              type: "info",
            },
          ]);

          // Upload lock to R2
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Uploading lock to R2...",
              type: "info",
            },
          ]);

          const uploadLockSuccess = await window.serverAPI.uploadLock(r2Config, selectedServer);

          if (uploadLockSuccess) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Lock uploaded to R2",
                type: "info",
              },
            ]);
          } else {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Warning: Failed to upload lock to R2",
                type: "warning",
              },
            ]);
          }
        } else {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Warning: Failed to create server lock",
              type: "warning",
            },
          ]);
        }

        // Simulate server start
        setTimeout(() => {
          setServerStatus(ServerStatus.RUNNING);
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Server started successfully",
              type: "info",
            },
          ]);
        }, 2000);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Failed to download server files",
            type: "error",
          },
        ]);
        setServerStatus(ServerStatus.STOPPED);
      }
    } else if (serverStatus === ServerStatus.RUNNING) {
      setServerStatus(ServerStatus.STOPPING);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Stopping server...",
          type: "info",
        },
      ]);

      // Upload server files to R2 before stopping
      setTimeout(async () => {
        if (selectedServer) {
          // Delete lock from R2
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Deleting lock from R2...",
              type: "info",
            },
          ]);

          const deleteLockSuccess = await window.serverAPI.deleteLock(r2Config, selectedServer);

          if (deleteLockSuccess) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Lock deleted from R2",
                type: "info",
              },
            ]);
          } else {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Warning: Failed to delete lock from R2",
                type: "warning",
              },
            ]);
          }

          // Delete local lock file
          const deleteLocalLockSuccess = await window.serverAPI.deleteLocalLock(selectedServer);

          if (deleteLocalLockSuccess) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Local lock deleted",
                type: "info",
              },
            ]);
          } else {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Warning: Failed to delete local lock",
                type: "warning",
              },
            ]);
          }

          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Uploading server files to R2...",
              type: "info",
            },
          ]);

          const r2Service = new R2Service(r2Config);
          const uploadSuccess = await r2Service.uploadServer(selectedServer);

          if (uploadSuccess) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Server files uploaded successfully",
                type: "info",
              },
            ]);
          } else {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Warning: Failed to upload server files to R2",
                type: "warning",
              },
            ]);
          }
        }

        setServerStatus(ServerStatus.STOPPED);
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Server stopped",
            type: "info",
          },
        ]);
      }, 2000);
    }
  };

  const handleReleaseLock = (): void => {
    if (!selectedServer) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Please select a server first",
          type: "error",
        },
      ]);
      return;
    }
    setIsReleaseLockModalOpen(true);
  };

  const handleConfirmReleaseLock = async (): Promise<void> => {
    if (!selectedServer) {
      return;
    }

    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: `Releasing lock for server: ${selectedServer}`,
        type: "warning",
      },
    ]);

    try {
      let anyLockDeleted = false;

      // Delete lock from R2
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Checking lock in R2...",
          type: "info",
        },
      ]);

      const deleteLockResult = await window.serverAPI.deleteLock(r2Config, selectedServer);

      if (deleteLockResult.success) {
        if (deleteLockResult.existed) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Lock deleted from R2 successfully",
              type: "info",
            },
          ]);
          anyLockDeleted = true;
        } else {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "No lock file found in R2",
              type: "info",
            },
          ]);
        }
      } else {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Warning: Failed to delete lock from R2",
            type: "warning",
          },
        ]);
      }

      // Delete local lock file
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Checking local lock file...",
          type: "info",
        },
      ]);

      const deleteLocalLockResult = await window.serverAPI.deleteLocalLock(selectedServer);

      if (deleteLocalLockResult.success) {
        if (deleteLocalLockResult.existed) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Local lock file deleted successfully",
              type: "info",
            },
          ]);
          anyLockDeleted = true;
        } else {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "No local lock file found",
              type: "info",
            },
          ]);
        }
      } else {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Warning: Failed to delete local lock file",
            type: "warning",
          },
        ]);
      }

      // Final message
      if (anyLockDeleted) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Lock released successfully",
            type: "info",
          },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "No lock files found to delete",
            type: "warning",
          },
        ]);
      }
    } catch (error) {
      console.error("Error releasing lock:", error);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Error releasing lock: ${error instanceof Error ? error.message : String(error)}`,
          type: "error",
        },
      ]);
    }
  };

  const handleSyncToR2 = async (): Promise<void> => {
    if (!selectedServer) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Please select a server first",
          type: "error",
        },
      ]);
      return;
    }

    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: `Syncing ${selectedServer} to R2...`,
        type: "info",
      },
    ]);

    const r2Service = new R2Service(r2Config);
    const uploadSuccess = await r2Service.uploadServer(selectedServer);

    if (uploadSuccess) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Server files synchronized successfully",
          type: "info",
        },
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Failed to sync server files to R2",
          type: "error",
        },
      ]);
    }
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

  const handleCreateServer = (): void => {
    console.log("Creating new server...");
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
              selectedServer={selectedServer}
              servers={servers}
              onSelectServer={setSelectedServer}
              onCreateServer={handleCreateServer}
              onStartStop={handleStartStop}
              onReleaseLock={handleReleaseLock}
              onSyncToR2={handleSyncToR2}
              onEditProperties={handleEditProperties}
              disabled={!isR2Configured || !isRcloneReady}
            />

            <UsernameInput
              username={username}
              onSave={handleSaveUsername}
              disabled={serverStatus !== ServerStatus.STOPPED}
            />

            <R2Configuration
              config={r2Config}
              onSave={handleSaveR2Config}
              disabled={serverStatus !== ServerStatus.STOPPED}
            />

            <NetworkConfiguration
              availableIps={availableIps}
              selectedIp={selectedIp}
              onSelectIp={setSelectedIp}
              disabled={serverStatus !== ServerStatus.STOPPED}
            />

            <RamConfiguration
              ramConfig={ramConfig}
              onChange={setRamConfig}
              disabled={serverStatus !== ServerStatus.STOPPED}
            />
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

        {/* Release Lock Modal */}
        <ReleaseLockModal
          open={isReleaseLockModalOpen}
          serverName={selectedServer}
          onClose={(): void => setIsReleaseLockModalOpen(false)}
          onConfirm={handleConfirmReleaseLock}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
