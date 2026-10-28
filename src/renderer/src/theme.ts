import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { createTheme } from "@mui/material";

export const monoFont = "'Geist Mono Variable', ui-monospace, monospace";

// Surfaces from darkest to lightest; the brand colors match the landing site
export const surface = {
  console: "#0b0d11",
  base: "#0f1115",
  panel: "#12161d",
  input: "#151922",
  raised: "#1a1f2a",
  border: "#2a303c",
  subtleBorder: "#1d222c",
};

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#2dd4bf", contrastText: surface.base },
    error: { main: "#d42d35" },
    success: { main: "#4ade80" },
    warning: { main: "#f5a524" },
    info: { main: "#2dd4bf" },
    background: { default: surface.base, paper: surface.panel },
    text: { primary: "#eaeaea", secondary: "#8b93a3" },
    divider: "#232834",
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: "'Geist Variable', system-ui, sans-serif",
    h6: { fontSize: 15, fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: "none",
          border: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "transparent" },
      styleOverrides: {
        root: { backgroundColor: surface.base, border: 0, borderBottom: "1px solid #232834" },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { backgroundColor: surface.raised, borderColor: surface.border } },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: surface.panel, border: 0 } },
    },
    MuiMenu: {
      styleOverrides: { paper: { backgroundColor: surface.raised, borderColor: surface.border } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: surface.input },
        notchedOutline: { borderColor: surface.border },
      },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: "none", fontWeight: 500, minHeight: 44 } },
    },
    MuiTabs: {
      styleOverrides: { root: { minHeight: 44 } },
    },
  },
});
