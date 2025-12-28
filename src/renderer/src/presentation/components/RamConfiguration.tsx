import React from "react";
import { Box, Typography, Paper, Stack, Slider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { RamConfig } from "../../domain/entities/ServerConfig";

interface RamConfigurationProps {
  ramConfig: RamConfig;
  onChange: (config: RamConfig) => void;
}

export const RamConfiguration: React.FC<RamConfigurationProps> = ({
  ramConfig,
  onChange,
}): React.JSX.Element => {
  const { t } = useTranslation();

  const handleMinChange = (_event: Event, value: number | number[]): void => {
    const newMin = value as number;
    onChange({ ...ramConfig, min: newMin });
  };

  const handleMaxChange = (_event: Event, value: number | number[]): void => {
    const newMax = value as number;
    onChange({ ...ramConfig, max: newMax });
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
            max={32}
            step={1}
            marks
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value} GB`}
          />
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t("ram.max")}: {ramConfig.max} GB
          </Typography>
          <Slider
            value={ramConfig.max}
            onChange={handleMaxChange}
            min={1}
            max={32}
            step={1}
            marks
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value} GB`}
          />
        </Box>
      </Stack>
    </Paper>
  );
};
