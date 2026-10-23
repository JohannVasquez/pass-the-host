"use client";

import { useEffect, useState } from "react";
import { DOWNLOAD_URL, type Downloads } from "./links";

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

interface DownloadButtonProps {
  downloads: Downloads;
  labels: { label: string; labelFor: string };
  className: string;
  showOS?: boolean;
  children?: React.ReactNode;
}

// Falls back to the GitHub releases page until the OS is known (SSR, mobile, unknown).
export function DownloadButton({
  downloads,
  labels,
  className,
  showOS = true,
  children,
}: DownloadButtonProps) {
  const [os, setOS] = useState<OS | null>(null);
  useEffect(() => setOS(detectOS()), []);

  const url = os ? downloads[os] : undefined;

  return (
    <a href={url ?? DOWNLOAD_URL} className={className}>
      {children}
      {url && os && showOS
        ? labels.labelFor.replace("{os}", OS_LABEL[os])
        : labels.label}
    </a>
  );
}
