import type { TransferProgress } from "@main/contexts/cloud-storage/domain/entities/S3Config";

const UNITS = ["B", "KiB", "MiB", "GiB", "TiB"];

/** "45.164 MiB" (rclone's binary units) -> bytes; NaN when it isn't a size */
export function parseSize(text: string): number {
  const match = text.trim().match(/^([0-9.]+)\s*([KMGT]?i?B)$/);
  if (!match) return NaN;
  const unit = match[2].replace("i", "");
  return parseFloat(match[1]) * 1024 ** UNITS.findIndex((u) => u.replace("i", "") === unit);
}

export function formatSize(bytes: number): string {
  let i = 0;
  while (bytes >= 1024 && i < UNITS.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${i === 0 ? bytes : bytes.toFixed(1)} ${UNITS[i]}`;
}

/**
 * rclone only counts files it has already queued in its total, so a batch of many files shows
 * roughly the current file's size. The manifest knows the real batch size: report against that.
 */
export function withKnownTotal(
  totalBytes: number,
  onProgress?: (progress: TransferProgress) => void,
): ((progress: TransferProgress) => void) | undefined {
  if (!onProgress) return undefined;
  return (progress) => {
    const transferred = parseSize(progress.transferred);
    if (!(totalBytes > 0) || Number.isNaN(transferred)) return onProgress(progress);
    const done = Math.min(transferred, totalBytes);
    onProgress({
      percent: Math.floor((done / totalBytes) * 100),
      transferred: formatSize(done),
      total: formatSize(totalBytes),
    });
  };
}
