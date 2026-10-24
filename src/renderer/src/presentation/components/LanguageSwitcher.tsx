import React from "react";
import { Box, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { Language as LanguageIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../../i18n/config";

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
    // Save language to config
    try {
      await window.configAPI.saveLanguage(lang);
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
        {LANGUAGES.map(({ code, name }) => (
          <MenuItem
            key={code}
            selected={i18n.language === code}
            onClick={() => handleLanguageChange(code)}
          >
            {name}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};
