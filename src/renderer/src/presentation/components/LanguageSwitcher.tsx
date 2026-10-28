import React from "react";
import { Box, Button, Menu, MenuItem, Tooltip } from "@mui/material";
import { Translate as TranslateIcon } from "@mui/icons-material";
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
        <Button
          onClick={handleClick}
          color="inherit"
          startIcon={<TranslateIcon />}
          sx={{ color: "#b4bac6", minWidth: 0, height: 36, px: 1, fontSize: 13 }}
        >
          {i18n.language.slice(0, 2).toUpperCase()}
        </Button>
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
