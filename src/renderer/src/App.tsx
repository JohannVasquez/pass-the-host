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
  IconButton,
  Tooltip,
} from "@mui/material";
import { BarChart as BarChartIcon } from "@mui/icons-material";
import { R2Configuration } from "./presentation/components/R2Configuration";
import { ServerControlPanel } from "./presentation/components/ServerControlPanel";
import { NetworkConfiguration } from "./presentation/components/NetworkConfiguration";
import { RamConfiguration } from "./presentation/components/RamConfiguration";
import { ServerConsole } from "./presentation/components/ServerConsole";
import { CommandInput } from "./presentation/components/CommandInput";
import { LanguageSwitcher } from "./presentation/components/LanguageSwitcher";
import { UsernameInput } from "./presentation/components/UsernameInput";
import { ReleaseLockModal } from "./presentation/components/ReleaseLockModal";
import { ServerLockedModal } from "./presentation/components/ServerLockedModal";
import { DownloadProgressModal } from "./presentation/components/DownloadProgressModal";
import { TransferProgressModal } from "./presentation/components/TransferProgressModal";
import { ServerStatisticsModal } from "./presentation/components/ServerStatisticsModal";
import { CreateServerModal } from "./presentation/components/CreateServerModal";
import { DeleteServerModal } from "./presentation/components/DeleteServerModal";
import { ServerStatus } from "./domain/entities/ServerStatus";
import { R2Config, RamConfig, NetworkInterface } from "./domain/entities/ServerConfig";
import { LogEntry } from "./domain/entities/LogEntry";
import { Server } from "./domain/entities/Server";
import { R2ServerRepository } from "./infrastructure/repositories/R2ServerRepository";
import { R2Service } from "./infrastructure/services/R2Service";
import { useTranslation } from "react-i18next";
import "./i18n/config";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App(): React.JSX.Element {
  const { t, i18n } = useTranslation();

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
  const [serverPort, setServerPort] = React.useState<number>(25565);
  const [username, setUsername] = React.useState<string>("");
  const [isReleaseLockModalOpen, setIsReleaseLockModalOpen] = React.useState<boolean>(false);
  const [isServerLockedModalOpen, setIsServerLockedModalOpen] = React.useState<boolean>(false);
  const [lockedServerInfo, setLockedServerInfo] = React.useState<{
    username: string;
    startedAt: string;
  }>({ username: "", startedAt: "" });
  const [isJavaDownloading, setIsJavaDownloading] = React.useState<boolean>(false);
  const [javaProgressMessage, setJavaProgressMessage] = React.useState<string>("");
  const [isRcloneDownloading, setIsRcloneDownloading] = React.useState<boolean>(false);
  const [rcloneProgressMessage, setRcloneProgressMessage] = React.useState<string>("");
  const [isTransferring, setIsTransferring] = React.useState<boolean>(false);
  const [transferType, setTransferType] = React.useState<"download" | "upload">("download");
  const [transferPercent, setTransferPercent] = React.useState<number>(0);
  const [transferTransferred, setTransferTransferred] = React.useState<string>("0");
  const [transferTotal, setTransferTotal] = React.useState<string>("0");
  const [logs, setLogs] = React.useState<LogEntry[]>([
    {
      timestamp: new Date(),
      message: "Pass the host! - Server Manager v1.0",
      type: "info",
    },
    {
      timestamp: new Date(),
      message: "Waiting for configuration...",
      type: "info",
    },
  ]);
  const [serverStartTime, setServerStartTime] = React.useState<Date | null>(null);
  const [isStatisticsModalOpen, setIsStatisticsModalOpen] = React.useState<boolean>(false);
  const [serverStatistics, setServerStatistics] = React.useState<any>(null);
  const [isCreateServerModalOpen, setIsCreateServerModalOpen] = React.useState<boolean>(false);
  const [isCreatingServer, setIsCreatingServer] = React.useState<boolean>(false);
  const [createServerProgress, setCreateServerProgress] = React.useState<string>("");
  const [isDeleteServerModalOpen, setIsDeleteServerModalOpen] = React.useState<boolean>(false);

  // Load configuration from config.json on mount
  React.useEffect(() => {
    const loadConfig = async (): Promise<void> => {
      try {
        const config = await window.configAPI.loadConfig();

        if (!config) {
          throw new Error("Failed to load config");
        }

        // Parse memory values (e.g., "2G" -> 2) with safe defaults
        const memMinStr = config.server?.memory_min || "2G";
        const memMaxStr = config.server?.memory_max || "4G";
        const memMin = parseInt(memMinStr.replace(/[^0-9]/g, ""), 10) || 2;
        const memMax = parseInt(memMaxStr.replace(/[^0-9]/g, ""), 10) || 4;

        setR2Config({
          endpoint: config.r2?.endpoint || "",
          access_key: config.r2?.access_key || "",
          secret_key: config.r2?.secret_key || "",
          bucket_name: config.r2?.bucket_name || "",
        });

        setRamConfig({
          min: memMin,
          max: memMax,
        });

        // Load username
        setUsername(config.app?.owner_name || "");

        // Load and set language
        const savedLanguage = config.app?.language || "en";
        i18n.changeLanguage(savedLanguage);

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

  // Listen to Java download progress
  React.useEffect(() => {
    const unsubscribe = window.javaAPI.onProgress((message: string) => {
      setJavaProgressMessage(message);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen to server creation progress
  React.useEffect(() => {
    const unsubscribe = window.serverAPI.onCreateProgress((message: string) => {
      setCreateServerProgress(message);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen to Rclone download progress
  React.useEffect(() => {
    const unsubscribe = window.rclone.onProgress((message: string) => {
      setRcloneProgressMessage(message);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen to Rclone transfer progress (upload/download)
  React.useEffect(() => {
    const unsubscribe = window.rclone.onTransferProgress((progress) => {
      setTransferPercent(progress.percent);
      setTransferTransferred(progress.transferred);
      setTransferTotal(progress.total);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen to server creation progress
  React.useEffect(() => {
    const unsubscribe = window.serverAPI.onCreateProgress((message) => {
      setCreateServerProgress(message);
    });

    return () => {
      unsubscribe();
    };
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
        setSelectedIp(interfaces[0].ip);

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

          // Show rclone download modal
          setIsRcloneDownloading(true);
          setRcloneProgressMessage("Preparing to download rclone...");

          const installSuccess = await window.rclone.installRclone();

          // Hide rclone download modal
          setIsRcloneDownloading(false);
          setRcloneProgressMessage("");

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
          await loadServersFromR2();
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

  React.useEffect(() => {
    const unsubscribe = window.serverAPI.onStdout((data: string) => {
      setLogs((prev) => {
        // Only show last 200 logs
        const newLogs = [
          ...prev,
          {
            timestamp: new Date(),
            message: data.trim(),
            type: "info" as const,
          },
        ];
        return newLogs.slice(-200);
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

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

  const handleSaveR2Config = async (config: R2Config): Promise<void> => {
    setR2Config(config);

    // Save to config.json
    const saveSuccess = await window.configAPI.saveR2Config(config);

    if (!saveSuccess) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Failed to save R2 configuration",
          type: "error",
        },
      ]);
      return;
    }

    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: "R2 configuration saved successfully",
        type: "info",
      },
    ]);

    // Validate configuration
    const isValid = validateR2Config(config);
    setIsR2Configured(isValid);

    if (!isValid) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "R2 configuration is incomplete",
          type: "warning",
        },
      ]);
      return;
    }

    // Test connection
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: "Testing R2 connection...",
        type: "info",
      },
    ]);

    const connectionSuccess = await window.rclone.testR2Connection({
      endpoint: config.endpoint,
      access_key: config.access_key,
      secret_key: config.secret_key,
      bucket_name: config.bucket_name,
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
      await loadServersFromR2();
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

  const handleSelectServer = async (serverId: string): Promise<void> => {
    setSelectedServer(serverId);

    // Load port from server.properties if server files exist locally
    try {
      const port = await window.serverAPI.readPort(serverId);
      setServerPort(port);

      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Server port loaded: ${port}`,
          type: "info",
        },
      ]);
    } catch (error) {
      console.error("Error reading server port:", error);
      // Keep default port 25565 if reading fails
      setServerPort(25565);
    }
  };

  const handlePortChange = (port: number): void => {
    setServerPort(port);
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

  const handleRamConfigChange = async (newRamConfig: RamConfig): Promise<void> => {
    setRamConfig(newRamConfig);
    const success = await window.configAPI.saveRamConfig(newRamConfig.min, newRamConfig.max);
    if (success) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `RAM configuration updated: Min ${newRamConfig.min}GB, Max ${newRamConfig.max}GB`,
          type: "info",
        },
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Failed to save RAM configuration",
          type: "error",
        },
      ]);
    }
  };

  // Store the server process reference
  const serverProcessRef = React.useRef<any>(null);

  const handleStartStop = async (): Promise<void> => {
    if (serverStatus === ServerStatus.STOPPED) {
      if (!selectedServer) {
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Please select a server first", type: "error" },
        ]);
        return;
      }
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
        { timestamp: new Date(), message: `Starting server: ${selectedServer}`, type: "info" },
      ]);

      // Check if server is locked
      setLogs((prev) => [
        ...prev,
        { timestamp: new Date(), message: "Checking server lock status...", type: "info" },
      ]);
      const lockInfo = await window.serverAPI.readLock(r2Config, selectedServer);

      if (lockInfo.exists) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Server is locked by ${lockInfo.username}`,
            type: "error",
          },
        ]);
        setLockedServerInfo({
          username: lockInfo.username || "Unknown",
          startedAt: lockInfo.startedAt || new Date().toISOString(),
        });
        setIsServerLockedModalOpen(true);
        setServerStatus(ServerStatus.STOPPED);
        return;
      }

      // Check if we need to download server files
      setLogs((prev) => [
        ...prev,
        { timestamp: new Date(), message: "Checking server files...", type: "info" },
      ]);

      const shouldDownload = await window.serverAPI.shouldDownload(r2Config, selectedServer);

      if (shouldDownload) {
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Downloading server files from R2...", type: "info" },
        ]);
        setIsTransferring(true);
        setTransferType("download");
        setTransferPercent(0);
        setTransferTransferred("0");
        setTransferTotal("0");
        const r2Service = new R2Service(r2Config);
        const downloadSuccess = await r2Service.downloadServer(selectedServer);
        setIsTransferring(false);
        if (!downloadSuccess) {
          setLogs((prev) => [
            ...prev,
            { timestamp: new Date(), message: "Failed to download server files", type: "error" },
          ]);
          setServerStatus(ServerStatus.STOPPED);
          return;
        }
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Server files downloaded successfully", type: "info" },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Local server files are up to date, skipping download",
            type: "info",
          },
        ]);
      }
      try {
        const portUpdateSuccess = await window.serverAPI.writePort(selectedServer, serverPort);
        if (portUpdateSuccess) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: `Server port configured to ${serverPort}`,
              type: "info",
            },
          ]);
        }
      } catch (error) {
        console.error("Error updating server port:", error);
      }
      const server = servers.find((s) => s.id === selectedServer);
      if (!server) {
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Server info not found", type: "error" },
        ]);
        setServerStatus(ServerStatus.STOPPED);
        return;
      }
      // Java check
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Checking Java requirements for Minecraft ${server.version}...`,
          type: "info",
        },
      ]);
      try {
        setIsJavaDownloading(true);
        setJavaProgressMessage("Checking Java requirements...");
        const javaResult = await window.javaAPI.ensureForMinecraft(server.version);
        setIsJavaDownloading(false);
        setJavaProgressMessage("");
        if (!javaResult.success) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: `Failed to setup Java ${javaResult.javaVersion}. Server may not start correctly.`,
              type: "error",
            },
          ]);
          setServerStatus(ServerStatus.STOPPED);
          return;
        }
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Java ${javaResult.javaVersion} is ready`,
            type: "info",
          },
        ]);
      } catch (error) {
        setIsJavaDownloading(false);
        setJavaProgressMessage("");
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Error setting up Java: ${error instanceof Error ? error.message : String(error)}`,
            type: "error",
          },
        ]);
        setServerStatus(ServerStatus.STOPPED);
        return;
      }
      // Create server lock
      setLogs((prev) => [
        ...prev,
        { timestamp: new Date(), message: "Creating server lock...", type: "info" },
      ]);
      const lockSuccess = await window.serverAPI.createLock(selectedServer, username || "Unknown");
      if (lockSuccess) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Server locked by: ${username || "Unknown"}`,
            type: "info",
          },
        ]);
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Uploading lock to R2...", type: "info" },
        ]);
        const uploadLockSuccess = await window.serverAPI.uploadLock(r2Config, selectedServer);
        if (uploadLockSuccess) {
          setLogs((prev) => [
            ...prev,
            { timestamp: new Date(), message: "Lock uploaded to R2", type: "info" },
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

      // Create session metadata
      setLogs((prev) => [
        ...prev,
        { timestamp: new Date(), message: "Creating session metadata...", type: "info" },
      ]);
      const sessionCreateSuccess = await window.serverAPI.createSession(
        selectedServer,
        username || "Unknown"
      );
      if (sessionCreateSuccess) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Session created for user: ${username || "Unknown"}`,
            type: "info",
          },
        ]);
      }

      // --- REAL SERVER START LOGIC ---
      // Get local server path from main process
      let localServerPath = "";
      try {
        localServerPath = await window.serverAPI.getLocalServerPath(selectedServer);
      } catch (e) {
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Could not get local server path", type: "error" },
        ]);
        setServerStatus(ServerStatus.STOPPED);
        return;
      }
      // Prepare command and args
      let startCmd = "";
      let startArgs: string[] = [];
      let workingDir = localServerPath;
      let javaPath = "";
      try {
        const javaResult = await window.javaAPI.ensureForMinecraft(server.version);
        javaPath = javaResult.javaPath;
      } catch (e) {
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Could not get Java path", type: "error" },
        ]);
        setServerStatus(ServerStatus.STOPPED);
        return;
      }
      if (server.type === "vanilla") {
        startCmd = javaPath;
        startArgs = [
          `-Xmx${ramConfig.max}G`,
          `-Xms${ramConfig.min}G`,
          "-jar",
          "server.jar",
          "nogui",
        ];
      } else if (server.type === "forge") {
        const versionNum = parseFloat(server.version);
        if (versionNum < 1.17) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "No se pudo iniciar el server Forge <= 1.16.5. No soportado.",
              type: "error",
            },
          ]);
          setServerStatus(ServerStatus.STOPPED);
          return;
        }
        try {
          await window.serverAPI.editForgeJvmArgs(selectedServer, ramConfig.min, ramConfig.max);
        } catch (e) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "No se pudo editar user_jvm_args.txt",
              type: "error",
            },
          ]);
        }
        // Read JVM args from run.bat/run.sh and construct Java command directly
        try {
          const jvmArgs = await window.serverAPI.readForgeJvmArgs(selectedServer);
          if (jvmArgs && jvmArgs.length > 0) {
            startCmd = javaPath;
            // The args from run.bat already include everything (JVM args, classpath, main class, and program args)
            // Forge server launcher already handles nogui mode
            startArgs = [...jvmArgs];
          } else {
            // Fallback to default args if file doesn't exist
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message:
                  "Warning: Could not read run.bat arguments, falling back to run.bat execution",
                type: "warning",
              },
            ]);
            // Fallback to original method using run.bat
            if (navigator.userAgent.includes("Windows")) {
              startCmd = "cmd";
              startArgs = ["/c", "run.bat"];
            } else {
              startCmd = "/bin/bash";
              startArgs = ["run.sh"];
            }
          }
        } catch (e) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: `Error reading JVM args: ${e instanceof Error ? e.message : String(e)}`,
              type: "error",
            },
          ]);
          setServerStatus(ServerStatus.STOPPED);
          return;
        }
      } else {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Tipo de server no soportado: ${server.type}`,
            type: "error",
          },
        ]);
        setServerStatus(ServerStatus.STOPPED);
        return;
      }
      try {
        const proc = await window.serverAPI.spawnServerProcess(
          selectedServer,
          startCmd,
          startArgs,
          workingDir
        );
        serverProcessRef.current = proc;
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Server started successfully", type: "info" },
        ]);
        setServerStartTime(new Date());
        setServerStatus(ServerStatus.RUNNING);
      } catch (e) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Error starting server: ${e instanceof Error ? e.message : String(e)}`,
            type: "error",
          },
        ]);
        setServerStatus(ServerStatus.STOPPED);
      }
    } else if (serverStatus === ServerStatus.RUNNING) {
      setServerStatus(ServerStatus.STOPPING);
      setLogs((prev) => [
        ...prev,
        { timestamp: new Date(), message: "Stopping server...", type: "info" },
      ]);
      // Kill the process
      if (selectedServer) {
        try {
          await window.serverAPI.killServerProcess(selectedServer);
          serverProcessRef.current = null;
        } catch (e) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: `Error stopping server: ${e instanceof Error ? e.message : String(e)}`,
              type: "error",
            },
          ]);
        }
      }
      // Upload server files to R2 before stopping
      setTimeout(async () => {
        if (selectedServer) {
          setLogs((prev) => [
            ...prev,
            { timestamp: new Date(), message: "Deleting lock from R2...", type: "info" },
          ]);
          const deleteLockSuccess = await window.serverAPI.deleteLock(r2Config, selectedServer);
          if (deleteLockSuccess) {
            setLogs((prev) => [
              ...prev,
              { timestamp: new Date(), message: "Lock deleted from R2", type: "info" },
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
          const deleteLocalLockSuccess = await window.serverAPI.deleteLocalLock(selectedServer);
          if (deleteLocalLockSuccess) {
            setLogs((prev) => [
              ...prev,
              { timestamp: new Date(), message: "Local lock deleted", type: "info" },
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
            { timestamp: new Date(), message: "Uploading server files to R2...", type: "info" },
          ]);
          setIsTransferring(true);
          setTransferType("upload");
          setTransferPercent(0);
          setTransferTransferred("0");
          setTransferTotal("0");
          const r2Service = new R2Service(r2Config);
          const uploadSuccess = await r2Service.uploadServer(selectedServer);
          setIsTransferring(false);
          if (uploadSuccess) {
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Server files uploaded successfully",
                type: "info",
              },
            ]);

            // Update and upload session metadata
            setLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                message: "Updating session metadata...",
                type: "info",
              },
            ]);

            const sessionUpdateSuccess = await window.serverAPI.updateSession(
              selectedServer,
              username || "Unknown"
            );
            if (sessionUpdateSuccess) {
              const sessionUploadSuccess = await window.serverAPI.uploadSession(
                r2Config,
                selectedServer
              );
              if (sessionUploadSuccess) {
                setLogs((prev) => [
                  ...prev,
                  {
                    timestamp: new Date(),
                    message: "Session metadata updated successfully",
                    type: "info",
                  },
                ]);
              } else {
                setLogs((prev) => [
                  ...prev,
                  {
                    timestamp: new Date(),
                    message: "Warning: Failed to upload session metadata",
                    type: "warning",
                  },
                ]);
              }
            }
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
        setServerStartTime(null);
        setServerStatus(ServerStatus.STOPPED);
        setLogs((prev) => [
          ...prev,
          { timestamp: new Date(), message: "Server stopped", type: "info" },
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

  const handleViewStatistics = async (): Promise<void> => {
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

    try {
      const stats = await window.serverAPI.getStatistics(selectedServer);
      setServerStatistics(stats);
      setIsStatisticsModalOpen(true);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Error loading statistics",
          type: "error",
        },
      ]);
    }
  };

  const handleConfirmCreateServer = async (
    serverName: string,
    version: string,
    serverType: "vanilla" | "forge"
  ): Promise<void> => {
    setIsCreatingServer(true);
    setCreateServerProgress("");

    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: `Creating server: ${serverName} (${serverType} ${version})`,
        type: "info",
      },
    ]);

    try {
      const success = await window.serverAPI.createMinecraftServer(serverName, version, serverType);

      if (success) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Server ${serverName} created successfully!`,
            type: "success",
          },
        ]);

        // Upload the newly created server to R2
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Uploading server to R2...",
            type: "info",
          },
        ]);

        setIsTransferring(true);
        setTransferType("upload");
        setTransferPercent(0);
        setTransferTransferred("0");
        setTransferTotal("0");

        const r2Service = new R2Service(r2Config);
        const uploadSuccess = await r2Service.uploadServer(serverName);

        setIsTransferring(false);

        if (!uploadSuccess) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Warning: Failed to upload server to R2. You can sync it manually later.",
              type: "warning",
            },
          ]);
        } else {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Server uploaded to R2 successfully",
              type: "info",
            },
          ]);
        }

        // Reload servers from R2
        await loadServersFromR2();

        // Select the newly created server
        setSelectedServer(serverName);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Failed to create server ${serverName}`,
            type: "error",
          },
        ]);
      }
    } catch (error) {
      console.error("Error creating server:", error);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Error creating server",
          type: "error",
        },
      ]);
    } finally {
      setIsCreatingServer(false);
      setCreateServerProgress("");
      setIsCreateServerModalOpen(false);
    }
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

    setIsTransferring(true);
    setTransferType("upload");
    setTransferPercent(0);
    setTransferTransferred("0");
    setTransferTotal("0");

    const r2Service = new R2Service(r2Config);
    const uploadSuccess = await r2Service.uploadServer(selectedServer);

    setIsTransferring(false);

    if (uploadSuccess) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Server files synchronized successfully",
          type: "info",
        },
      ]);

      // Update and upload session metadata
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Updating session metadata...",
          type: "info",
        },
      ]);

      const sessionUpdateSuccess = await window.serverAPI.updateSession(
        selectedServer,
        username || "Unknown"
      );
      if (sessionUpdateSuccess) {
        const sessionUploadSuccess = await window.serverAPI.uploadSession(r2Config, selectedServer);
        if (sessionUploadSuccess) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Session metadata updated successfully",
              type: "info",
            },
          ]);
        } else {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              message: "Warning: Failed to upload session metadata",
              type: "warning",
            },
          ]);
        }
      }
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
    console.debug("Opening server.properties editor");
  };

  const handleOpenServerFolder = async (): Promise<void> => {
    if (!selectedServer) return;

    try {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Opening folder for server: ${selectedServer}`,
          type: "info",
        },
      ]);

      // Asumiendo que tienes un método en tu API para esto.
      // Si no existe, deberás crearlo en tu main process (Electron).
      await window.serverAPI.openServerFolder(selectedServer);
    } catch (error) {
      console.error("Error opening folder:", error);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Failed to open server folder",
          type: "error",
        },
      ]);
    }
  };

  const handleExecuteCommand = async (command: string): Promise<void> => {
    if (!selectedServer) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "No server selected",
          type: "error",
        },
      ]);
      return;
    }

    if (serverStatus !== ServerStatus.RUNNING) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Server is not running",
          type: "error",
        },
      ]);
      return;
    }

    // Log the command being sent
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: `> ${command}`,
        type: "info",
      },
    ]);

    // Send the command to the server process
    try {
      const success = await window.serverAPI.sendCommand(selectedServer, command);
      if (!success) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Failed to send command to server",
            type: "error",
          },
        ]);
      }
    } catch (error) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Error sending command: ${error instanceof Error ? error.message : String(error)}`,
          type: "error",
        },
      ]);
    }
  };

  const handleCreateServer = (): void => {
    setIsCreateServerModalOpen(true);
  };

  const handleDeleteServer = (): void => {
    setIsDeleteServerModalOpen(true);
  };

  const handleConfirmDeleteServer = async (deleteLocally: boolean): Promise<void> => {
    if (!selectedServer) return;

    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: `Deleting server: ${selectedServer}...`,
        type: "info",
      },
    ]);

    // Delete from R2
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: "Deleting from R2...",
        type: "info",
      },
    ]);

    const r2Result = await window.serverAPI.deleteFromR2(r2Config, selectedServer);
    if (!r2Result.success) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: `Failed to delete from R2: ${r2Result.error || "Unknown error"}`,
          type: "error",
        },
      ]);
      return;
    }

    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: "Deleted from R2 successfully",
        type: "info",
      },
    ]);

    // Delete locally if checkbox was checked
    if (deleteLocally) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          message: "Deleting local files...",
          type: "info",
        },
      ]);

      const localResult = await window.serverAPI.deleteLocally(selectedServer);
      if (!localResult.success) {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: `Failed to delete local files: ${localResult.error || "Unknown error"}`,
            type: "warning",
          },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date(),
            message: "Local files deleted successfully",
            type: "info",
          },
        ]);
      }
    }

    // Refresh server list
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        message: "Server deleted successfully",
        type: "info",
      },
    ]);

    // Clear selection
    setSelectedServer(null);

    // Reload servers from R2
    await loadServersFromR2();

    setIsDeleteServerModalOpen(false);
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
              Pass the host!
            </Typography>
            <Tooltip title={t("serverControl.viewStatistics")}>
              <span>
                <IconButton
                  color="inherit"
                  onClick={handleViewStatistics}
                  disabled={!selectedServer}
                >
                  <BarChartIcon />
                </IconButton>
              </span>
            </Tooltip>
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
              onSelectServer={handleSelectServer}
              onCreateServer={handleCreateServer}
              onStartStop={handleStartStop}
              onReleaseLock={handleReleaseLock}
              onSyncToR2={handleSyncToR2}
              onEditProperties={handleEditProperties}
              onOpenServerFolder={handleOpenServerFolder}
              onDeleteServer={handleDeleteServer}
              disabled={!isR2Configured || !isRcloneReady}
              serverStartTime={serverStartTime}
              username={username}
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
              serverPort={serverPort}
              onSelectIp={setSelectedIp}
              onPortChange={handlePortChange}
              disabled={serverStatus !== ServerStatus.STOPPED}
            />

            <RamConfiguration
              ramConfig={ramConfig}
              onChange={handleRamConfigChange}
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

        {/* Server Locked Modal */}
        <ServerLockedModal
          open={isServerLockedModalOpen}
          serverName={selectedServer}
          username={lockedServerInfo.username}
          startedAt={lockedServerInfo.startedAt}
          onClose={(): void => setIsServerLockedModalOpen(false)}
        />

        {/* Rclone Download Modal */}
        <DownloadProgressModal
          open={isRcloneDownloading}
          title={t("rclone.modalTitle")}
          message={rcloneProgressMessage}
        />

        {/* Java Download Modal */}
        <DownloadProgressModal
          open={isJavaDownloading}
          title={t("java.modalTitle")}
          message={javaProgressMessage}
        />

        {/* Transfer Progress Modal */}
        <TransferProgressModal
          open={isTransferring}
          type={transferType}
          percent={transferPercent}
          transferred={transferTransferred}
          total={transferTotal}
        />

        {/* Server Statistics Modal */}
        <ServerStatisticsModal
          open={isStatisticsModalOpen}
          onClose={() => setIsStatisticsModalOpen(false)}
          serverName={selectedServer}
          statistics={serverStatistics}
        />

        {/* Create Server Modal */}
        <CreateServerModal
          open={isCreateServerModalOpen}
          onClose={() => setIsCreateServerModalOpen(false)}
          onConfirm={handleConfirmCreateServer}
          isCreating={isCreatingServer}
          progressMessage={createServerProgress}
        />

        {/* Delete Server Modal */}
        <DeleteServerModal
          open={isDeleteServerModalOpen}
          serverName={selectedServer}
          onClose={() => setIsDeleteServerModalOpen(false)}
          onConfirm={handleConfirmDeleteServer}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
