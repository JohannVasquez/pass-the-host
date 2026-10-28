import React, { useState, useEffect } from "react";
import { Box, Typography, Stack, Slider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { monoFont } from "@renderer/theme";
import { RamConfig } from "@renderer/domain/entities/ServerConfig";

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
  const [maxSystemMemory, setMaxSystemMemory] = useState<number>(32);

  useEffect(() => {
    const fetchSystemMemory = async (): Promise<void> => {
      try {
        const totalMemory = await window.systemAPI.getTotalMemoryGB();
        setMaxSystemMemory(totalMemory);
      } catch (error) {
        console.error("Error fetching system memory:", error);
        // Fallback to 32GB if there's an error
        setMaxSystemMemory(32);
      }
    };

    fetchSystemMemory();
  }, []);

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
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2">{t("ram.min")}</Typography>
          <Typography variant="body2" sx={{ fontFamily: monoFont, color: "primary.main" }}>
            {ramConfig.min} GB
          </Typography>
        </Stack>
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
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2">{t("ram.max")}</Typography>
          <Typography variant="body2" sx={{ fontFamily: monoFont, color: "primary.main" }}>
            {ramConfig.max} GB
          </Typography>
        </Stack>
        <Slider
          value={ramConfig.max}
          onChange={handleMaxChange}
          min={ramConfig.min}
          max={maxSystemMemory}
          step={1}
          marks
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value} GB`}
          disabled={disabled}
        />
      </Box>
    </Stack>
  );
};
