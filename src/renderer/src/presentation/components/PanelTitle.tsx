import React from "react";
import { Typography, type TypographyProps } from "@mui/material";

interface PanelTitleProps extends TypographyProps {
  icon: React.ReactElement;
}

/** Panel heading with a leading icon, shared by the sidebar panels. */
export const PanelTitle: React.FC<PanelTitleProps> = ({ icon, children, sx, ...props }) => (
  <Typography
    variant="h6"
    {...props}
    sx={[
      { display: "flex", alignItems: "center", gap: 1, "& > svg": { color: "primary.main" } },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {icon}
    {children}
  </Typography>
);
