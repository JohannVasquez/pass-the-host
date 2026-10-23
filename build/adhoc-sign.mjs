// Ad-hoc sign the macOS app: without an Apple Developer ID this avoids the "app is damaged" Gatekeeper error
import { execFileSync } from "child_process";
import path from "path";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async function ({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName !== "darwin") return;
  const app = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
}
