"use client";

import { useEffect, useState } from "react";
import { DOWNLOAD_URL, MS_STORE_URL, type Downloads } from "./links";

const OS_LABEL = { windows: "Windows", mac: "macOS", linux: "Linux" } as const;
type OS = keyof typeof OS_LABEL;

function detectOS(): OS | null {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return null;
  if (/Windows/i.test(ua)) return "windows";
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/Mac/i.test(ua)) return navigator.maxTouchPoints > 1 ? null : "mac";
  if (/Linux|X11/i.test(ua)) return "linux";
  return null;
}

// Microsoft Store bag with the four-square Microsoft mark
function MicrosoftStoreLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M8 7.5V6a4 4 0 0 1 8 0v1.5"
        fill="none"
        stroke="#0F1115"
        strokeWidth="1.8"
      />
      <rect x="2.5" y="7" width="19" height="15" rx="2.5" fill="#0F1115" />
      <rect x="7.6" y="10.1" width="4.1" height="4.1" fill="#F25022" />
      <rect x="12.3" y="10.1" width="4.1" height="4.1" fill="#7FBA00" />
      <rect x="7.6" y="14.8" width="4.1" height="4.1" fill="#00A4EF" />
      <rect x="12.3" y="14.8" width="4.1" height="4.1" fill="#FFB900" />
    </svg>
  );
}

interface DownloadButtonProps {
  downloads: Downloads;
  labels: { label: string; labelFor: string; store: string; direct: string };
  className: string;
  // When set, Windows visitors get the Store (className) plus a direct .exe download (this)
  secondaryClassName?: string;
  showOS?: boolean;
  children?: React.ReactNode;
}

// Falls back to the GitHub releases page until the OS is known (SSR, mobile, unknown).
export function DownloadButton({
  downloads,
  labels,
  className,
  secondaryClassName,
  showOS = true,
  children,
}: DownloadButtonProps) {
  const [os, setOS] = useState<OS | null>(null);
  useEffect(() => setOS(detectOS()), []);

  const url = os ? downloads[os] : undefined;

  if (os === "windows" && secondaryClassName) {
    return (
      <>
        <a href={MS_STORE_URL} className={className}>
          <MicrosoftStoreLogo />
          {labels.store}
        </a>
        <a href={url ?? DOWNLOAD_URL} className={secondaryClassName}>
          {children}
          {labels.direct}
        </a>
      </>
    );
  }

  return (
    <a href={url ?? DOWNLOAD_URL} className={className}>
      {children}
      {url && os && showOS
        ? labels.labelFor.replace("{os}", OS_LABEL[os])
        : labels.label}
    </a>
  );
}
