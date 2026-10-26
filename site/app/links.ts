export const GITHUB_URL = "https://github.com/JohannVasquez/pass-the-host";
export const DOWNLOAD_URL = `${GITHUB_URL}/releases/latest`;
// Store builds are signed (no SmartScreen warning) and update themselves
export const MS_STORE_URL = "https://apps.microsoft.com/detail/9P12F6CZLBR0";

export type Downloads = {
  version: string | null;
  windows?: string;
  mac?: string;
  linux?: string;
  count?: string;
};

interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: {
    name: string;
    browser_download_url: string;
    download_count: number;
  }[];
}

const INSTALLERS = [".exe", ".dmg", ".AppImage", ".deb"];
const MIN_DOWNLOADS_SHOWN = 1000;

// Rounded down to whole thousands ("1k+", "12k+"); hidden below 1k so a small number doesn't hurt.
export function formatDownloadCount(n: number): string | undefined {
  if (n < MIN_DOWNLOADS_SHOWN) return undefined;
  return `${Math.floor(n / 1000)}k+`;
}

// Asset names include the version, so resolve them from the latest release (cached 1h).
// Counts only installers: the .yml/.blockmap/.zip files are fetched by the auto-updater.
export async function getDownloads(): Promise<Downloads> {
  try {
    // ponytail: first page only (100 releases, ~2MB which is Next's fetch cache limit); paginate past that
    const res = await fetch(
      "https://api.github.com/repos/JohannVasquez/pass-the-host/releases?per_page=100",
      {
        // Unauthenticated requests share Vercel's build IPs and hit GitHub's 60/h limit
        headers: process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : undefined,
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) {
      console.error(`GitHub releases request failed: ${res.status}`);
      return { version: null };
    }

    const releases: GitHubRelease[] = await res.json();
    const release = releases.find((r) => !r.draft && !r.prerelease);
    if (!release) return { version: null };

    const total = releases
      .flatMap((r) => r.assets)
      .filter((a) => INSTALLERS.some((ext) => a.name.endsWith(ext)))
      .reduce((sum, a) => sum + a.download_count, 0);

    const find = (ext: string) =>
      release.assets.find((a) => a.name.endsWith(ext))?.browser_download_url;

    return {
      version: release.tag_name,
      windows: find(".exe"),
      mac: find(".dmg"),
      linux: find(".AppImage"),
      count: formatDownloadCount(total),
    };
  } catch {
    return { version: null };
  }
}
