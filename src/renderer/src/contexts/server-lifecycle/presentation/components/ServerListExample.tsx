import React, { useEffect, useState } from "react";
import { Box, Typography, CircularProgress, Alert } from "@mui/material";
import { useDependency } from "@contexts/shared/hooks";
import { SERVER_LIFECYCLE_TYPES } from "@shared/di/types";
import type { ListServersUseCase } from "@server-lifecycle/application/use-cases";
import type { Server } from "@server-lifecycle/domain/entities";

/**
 * Example component to test server-lifecycle context integration
 */
export const ServerListExample: React.FC = () => {
  const listServersUseCase = useDependency<ListServersUseCase>(
    SERVER_LIFECYCLE_TYPES.ListServersUseCase
  );
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listServersUseCase) return;

    const loadServers = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const result = await listServersUseCase.execute();
        setServers(result);
      } catch (err) {
        console.error("Error loading servers:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadServers();
  }, [listServersUseCase]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading servers: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Available Servers ({servers.length})
      </Typography>
      {servers.length === 0 ? (
        <Typography color="text.secondary">No servers found</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", p: 0 }}>
          {servers.map((server) => (
            <Box
              key={server.id}
              component="li"
              sx={{
                p: 2,
                mb: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle1">{server.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Version: {server.version} | Type: {server.type}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
