export const GITHUB_URL = "https://github.com/JohannVasquez/pass-the-host";
export const DOWNLOAD_URL = `${GITHUB_URL}/releases/latest`;

export type Downloads = {
  version: string | null;
  windows?: string;
  mac?: string;
  linux?: string;
};

interface GitHubRelease {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}

// Asset names include the version, so resolve them from the latest release (cached 1h).
export async function getDownloads(): Promise<Downloads> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/JohannVasquez/pass-the-host/releases/latest",
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

    const release: GitHubRelease = await res.json();
    const find = (ext: string) =>
      release.assets.find((a) => a.name.endsWith(ext))?.browser_download_url;

    return {
      version: release.tag_name,
      windows: find(".exe"),
      mac: find(".dmg"),
      linux: find(".AppImage"),
    };
  } catch {
    return { version: null };
  }
}
