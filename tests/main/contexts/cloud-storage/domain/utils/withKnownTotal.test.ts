import { describe, it, expect, vi } from "vitest";
import {
  formatSize,
  parseSize,
  withKnownTotal,
} from "@main/contexts/cloud-storage/domain/utils/withKnownTotal";

describe("withKnownTotal", () => {
  it("parses and formats rclone's binary units", () => {
    expect(parseSize("15.5 MiB")).toBe(15.5 * 1024 ** 2);
    expect(parseSize("512 B")).toBe(512);
    expect(parseSize("Complete")).toBeNaN();
    expect(formatSize(3 * 1024 ** 3)).toBe("3.0 GiB");
  });

  it("reports progress against the whole batch, not rclone's running total", () => {
    const onProgress = vi.fn();
    const report = withKnownTotal(100 * 1024 ** 2, onProgress)!;
    report({ percent: 50, transferred: "25 MiB", total: "50 MiB" });
    expect(onProgress).toHaveBeenLastCalledWith({
      percent: 25,
      transferred: "25.0 MiB",
      total: "100.0 MiB",
    });
  });

  it("passes non-size updates through and never goes past the total", () => {
    const onProgress = vi.fn();
    const report = withKnownTotal(1024, onProgress)!;
    report({ percent: 100, transferred: "Complete", total: "Complete" });
    expect(onProgress).toHaveBeenLastCalledWith({
      percent: 100,
      transferred: "Complete",
      total: "Complete",
    });
    report({ percent: 100, transferred: "2 KiB", total: "2 KiB" });
    expect(onProgress).toHaveBeenLastCalledWith({
      percent: 100,
      transferred: "1.0 KiB",
      total: "1.0 KiB",
    });
    expect(withKnownTotal(1024)).toBeUndefined();
  });
});
