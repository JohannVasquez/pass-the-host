import { describe, it, expect } from "vitest";
import { hostingChanges } from "@renderer/contexts/p2p-tunnel/infrastructure/hostingChanges";

const member = (clientId: string, hosting: boolean, isYou = false) => ({
  clientId,
  name: clientId,
  hosting,
  isYou,
  ...(hosting ? { serverName: "Survival", hostingSince: 1000 } : {}),
});

describe("hostingChanges", () => {
  it("reports nothing for the first snapshot of a network", () => {
    expect(hostingChanges(null, [member("ana", true)])).toEqual([]);
  });

  it("reports a friend who starts hosting", () => {
    expect(hostingChanges([member("ana", false)], [member("ana", true)])).toEqual([
      { type: "started", member: member("ana", true) },
    ]);
  });

  it("reports a stop with the details from before, also when the host vanished", () => {
    expect(hostingChanges([member("ana", true)], [member("ana", false)])).toEqual([
      { type: "stopped", member: member("ana", true) },
    ]);
    expect(
      hostingChanges([member("ana", true), member("bo", false)], [member("bo", false)]),
    ).toEqual([{ type: "stopped", member: member("ana", true) }]);
  });

  it("ignores yourself and members whose state didn't change", () => {
    expect(
      hostingChanges(
        [member("me", false, true), member("ana", true), member("bo", false)],
        [member("me", true, true), member("ana", true), member("bo", false), member("cy", false)],
      ),
    ).toEqual([]);
  });
});
