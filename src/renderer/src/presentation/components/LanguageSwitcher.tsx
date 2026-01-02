import React from "react";
import { Box, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { Language as LanguageIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

export const LanguageSwitcher: React.FC = (): React.JSX.Element => {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleLanguageChange = async (lang: string): Promise<void> => {
    i18n.changeLanguage(lang);
    // Save language to config so main process can use it
    try {
      await window.electron.ipcRenderer.invoke("config:save-language", lang);
    } catch (error) {
      console.error("Failed to save language:", error);
    }
    handleClose();
  };

  return (
    <Box>
      <Tooltip title={t("language.title")}>
        <IconButton onClick={handleClick} color="inherit">
          <LanguageIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => handleLanguageChange("en")}>{t("language.en")}</MenuItem>
        <MenuItem onClick={() => handleLanguageChange("es")}>{t("language.es")}</MenuItem>
      </Menu>
    </Box>
  );
};
