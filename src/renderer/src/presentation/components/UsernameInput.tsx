import React from "react";
import { Box, TextField, Typography, IconButton } from "@mui/material";
import { Edit as EditIcon, Check as CheckIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { surface } from "@renderer/theme";

interface UsernameInputProps {
  username: string;
  onSave: (username: string) => void;
  disabled?: boolean;
}

export const UsernameInput: React.FC<UsernameInputProps> = ({
  username,
  onSave,
  disabled = false,
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [tempUsername, setTempUsername] = React.useState<string>(username);
  
  React.useEffect(() => {
    setTempUsername(username);
  }, [username]);

  const handleSave = (): void => {
    if (tempUsername.trim() !== "") {
      onSave(tempUsername.trim());
      setIsEditing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setTempUsername(username);
      setIsEditing(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        minHeight: 48,
        px: 2,
        borderRadius: 1,
        border: 1,
        borderColor: surface.border,
        bgcolor: surface.panel,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {t("username.title")}
      </Typography>
      {isEditing ? (
        <>
          <TextField
            fullWidth
            size="small"
            value={tempUsername}
            onChange={(e) => setTempUsername(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t("username.placeholder")}
            disabled={disabled}
            autoFocus
          />
          <IconButton
            color="primary"
            size="small"
            onClick={handleSave}
            disabled={disabled || tempUsername.trim() === ""}
          >
            <CheckIcon fontSize="small" />
          </IconButton>
        </>
      ) : (
        <>
          <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
            {username || t("username.notSet")}
          </Typography>
          <IconButton
            size="small"
            sx={{ color: "#b4bac6" }}
            onClick={() => setIsEditing(true)}
            disabled={disabled}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </>
      )}
    </Box>
  );
};
