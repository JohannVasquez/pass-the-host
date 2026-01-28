import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";

interface SessionEntry {
  username: string;
  startTime: string;
  startTimestamp: number;
  endTime?: string;
  endTimestamp?: number;
  duration?: number;
}

interface ServerStatisticsModalProps {
  open: boolean;
  onClose: () => void;
  serverName: string | null;
  statistics: {
    totalPlaytime: number;
    sessionCount: number;
    sessions: SessionEntry[];
  } | null;
}

export const ServerStatisticsModal: React.FC<ServerStatisticsModalProps> = ({
  open,
  onClose,
  serverName,
  statistics,
}): React.JSX.Element => {
  const { t } = useTranslation();

  // Format duration from milliseconds to readable format (days, hours, minutes, seconds)
  const formatDuration = (ms: number | undefined): string => {
    if (!ms) return `0 ${t("statistics.seconds")}`;

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days} ${t("statistics.days")}`);
    }
    if (hours > 0) {
      parts.push(`${hours} ${t("statistics.hours")}`);
    }
    if (minutes > 0) {
      parts.push(`${minutes} ${t("statistics.minutes")}`);
    }
    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds} ${t("statistics.seconds")}`);
    }

    return parts.join(", ");
  };

  // Format date to readable format
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  // Define columns for the DataGrid
  const columns: GridColDef[] = [
    {
      field: "username",
      headerName: t("statistics.username"),
      flex: 1,
      minWidth: 150,
    },
    {
      field: "startTime",
      headerName: t("statistics.startTime"),
      flex: 1.5,
      minWidth: 200,
      valueFormatter: (value) => formatDate(value),
    },
    {
      field: "endTime",
      headerName: t("statistics.endTime"),
      flex: 1.5,
      minWidth: 200,
      valueFormatter: (value) => (value ? formatDate(value) : t("statistics.inProgress")),
    },
    {
      field: "duration",
      headerName: t("statistics.duration"),
      flex: 1.5,
      minWidth: 200,
      valueFormatter: (value) => formatDuration(value),
    },
  ];

  // Prepare rows for the DataGrid
  const rows =
    statistics?.sessions.map((session, index) => ({
      id: index,
      username: session.username,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
    })) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {t("statistics.title")} - {serverName}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {statistics ? (
          <>
            {/* Summary Section */}
            <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                {t("statistics.summary")}
              </Typography>
              <Box sx={{ display: "flex", gap: 4, mt: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t("statistics.totalPlaytime")}
                  </Typography>
                  <Typography variant="h5" fontFamily="monospace">
                    {formatDuration(statistics.totalPlaytime)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t("statistics.totalSessions")}
                  </Typography>
                  <Typography variant="h5">{statistics.sessionCount}</Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Sessions Table */}
            <Typography variant="h6" gutterBottom>
              {t("statistics.sessionHistory")}
            </Typography>
            <Box sx={{ height: 400, width: "100%" }}>
              <DataGrid
                rows={rows}
                columns={columns}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 5, page: 0 },
                  },
                }}
                pageSizeOptions={[5, 10, 25]}
                disableRowSelectionOnClick
                sx={{
                  "& .MuiDataGrid-cell": {
                    fontSize: "0.875rem",
                  },
                }}
              />
            </Box>
          </>
        ) : (
          <Typography variant="body1" color="text.secondary">
            {t("statistics.noData")}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};
