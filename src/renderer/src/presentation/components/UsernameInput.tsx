import React from "react";
import { Box, TextField, Paper, Typography, IconButton } from "@mui/material";
import { Edit as EditIcon, Check as CheckIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

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
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t("username.title")}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
            <IconButton onClick={handleSave} disabled={disabled || tempUsername.trim() === ""}>
              <CheckIcon />
            </IconButton>
          </>
        ) : (
          <>
            <Box sx={{ flex: 1, bgcolor: "action.hover", p: 1.5, borderRadius: 1 }}>
              <Typography variant="body1" fontWeight="medium">
                {username || t("username.notSet")}
              </Typography>
            </Box>
            <IconButton onClick={() => setIsEditing(true)} disabled={disabled}>
              <EditIcon />
            </IconButton>
          </>
        )}
      </Box>
    </Paper>
  );
};
