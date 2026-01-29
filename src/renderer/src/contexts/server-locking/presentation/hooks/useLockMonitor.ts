import { useEffect } from "react";
import { useDependency } from "@contexts/shared/hooks";
import { SERVER_LOCKING_TYPES } from "@shared/di";
import type { MonitorServerLockUseCase } from "@server-locking/application/use-cases";
import type { S3Config } from "@cloud-storage/domain/entities";

/**
 * Custom hook to monitor server lock status
 * Automatically starts/stops monitoring based on conditions
 *
 * @param serverId - The server ID to monitor (null if none selected)
 * @param s3Config - S3 configuration for accessing remote storage
 * @param isEnabled - Whether monitoring should be active
 * @param intervalMs - Base polling interval in milliseconds (default: 10000ms = 10s)
 */
export function useLockMonitor(
  serverId: string | null,
  s3Config: S3Config,
  isEnabled: boolean,
  intervalMs: number = 10000,
): void {
  const monitorUseCase = useDependency<MonitorServerLockUseCase>(
    SERVER_LOCKING_TYPES.MonitorServerLockUseCase,
  );

  useEffect(() => {
    // Don't monitor if:
    // - Monitoring is disabled
    // - No server selected
    // - Use case not available
    if (!isEnabled || !serverId || !monitorUseCase) {
      monitorUseCase?.stop();
      return;
    }

    // Start monitoring
    monitorUseCase.start(s3Config, serverId, intervalMs);

    // Cleanup: stop monitoring when component unmounts or dependencies change
    return () => {
      monitorUseCase.stop();
    };
  }, [serverId, s3Config, isEnabled, intervalMs, monitorUseCase]);
}
