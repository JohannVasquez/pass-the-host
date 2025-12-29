import React from "react";
import { Box, Typography, Paper, Stack, Slider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { RamConfig } from "../../domain/entities/ServerConfig";

interface RamConfigurationProps {
  ramConfig: RamConfig;
  onChange: (config: RamConfig) => void;
  disabled?: boolean;
}

export const RamConfiguration: React.FC<RamConfigurationProps> = ({
  ramConfig,
  onChange,
  disabled = false,
}): React.JSX.Element => {
  const { t } = useTranslation();

  const handleMinChange = (_event: Event, value: number | number[]): void => {
    const newMin = value as number;
    // Evitar que min sea mayor que max
    if (newMin > ramConfig.max) {
      onChange({ ...ramConfig, min: ramConfig.max });
    } else {
      onChange({ ...ramConfig, min: newMin });
    }
  };

  const handleMaxChange = (_event: Event, value: number | number[]): void => {
    const newMax = value as number;
    // Evitar que max sea menor que min
    if (newMax < ramConfig.min) {
      onChange({ ...ramConfig, max: ramConfig.min });
    } else {
      onChange({ ...ramConfig, max: newMax });
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t("ram.title")}
      </Typography>
      <Stack spacing={3}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t("ram.min")}: {ramConfig.min} GB
          </Typography>
          <Slider
            value={ramConfig.min}
            onChange={handleMinChange}
            min={1}
            max={ramConfig.max}
            step={1}
            marks
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value} GB`}
            disabled={disabled}
          />
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t("ram.max")}: {ramConfig.max} GB
          </Typography>
          <Slider
            value={ramConfig.max}
            onChange={handleMaxChange}
            min={ramConfig.min}
            max={32}
            step={1}
            marks
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value} GB`}
            disabled={disabled}
          />
        </Box>
      </Stack>
    </Paper>
  );
};
