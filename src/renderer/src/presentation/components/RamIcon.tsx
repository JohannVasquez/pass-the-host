import { createSvgIcon } from "@mui/material";

// Material has no RAM-stick icon (Memory reads as a CPU), so this draws one as line art:
// module with side notches and a chip area, plus the contact strip with its key notch.
export const RamIcon = createSvgIcon(
  <g
    fill="none"
    stroke="currentColor"
    strokeWidth={1.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.8 5.5h18.4a1 1 0 0 1 1 1v2.9a.9.9 0 0 0 0 1.8v2.9a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1v-2.9a.9.9 0 0 0 0-1.8V6.5a1 1 0 0 1 1-1z" />
    <path d="M3.4 15.1v3.2h7.8v-.7a.8.8 0 0 1 1.6 0v.7h7.8v-3.2" />
    <rect x={4.4} y={7.7} width={15.2} height={5} rx={0.4} />
    <path d="M5.3 18.3v-1.3M7.3 18.3v-1.3M9.3 18.3v-1.3M14.7 18.3v-1.3M16.7 18.3v-1.3M18.7 18.3v-1.3" />
  </g>,
  "Ram",
);
