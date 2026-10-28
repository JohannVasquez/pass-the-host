import { describe, it, expect } from "vitest";
import {
  answerFrom,
  diagFrom,
  offerFor,
} from "@renderer/contexts/p2p-tunnel/infrastructure/signaling";

describe("signaling", () => {
  it("accepts an answer only from the host we offered to", () => {
    const data = { peerId: "p1", sdp: "answer-sdp" };
    expect(answerFrom({ clientId: "host", data }, "host", "p1")).toBe("answer-sdp");
    // Any member sees the peerId in the offer and could race the host
    expect(answerFrom({ clientId: "intruder", data }, "host", "p1")).toBeNull();
    expect(answerFrom({ clientId: "host", data }, "host", "p2")).toBeNull();
  });

  it("accepts only well-formed offers addressed to this host", () => {
    const data = { peerId: "p1", sdp: "offer-sdp", to: "host" };
    expect(offerFor({ clientId: "friend", data }, "host")).toEqual(data);
    expect(offerFor({ clientId: "friend", data }, "other-host")).toBeNull();
    // Older apps don't address their offers
    expect(
      offerFor({ clientId: "friend", data: { peerId: "p1", sdp: "s" } }, "host"),
    ).not.toBeNull();
    expect(offerFor({ clientId: "friend", data: { ...data, sdp: 1 } }, "host")).toBeNull();
    expect(offerFor({ clientId: "friend", data: null }, "host")).toBeNull();
  });

  it("accepts only well-formed diagnostics addressed to this host", () => {
    const data = { to: "host", code: "port_changed", detail: "25566" };
    expect(diagFrom({ clientId: "friend", data }, "host")).toEqual({
      from: "friend",
      code: "port_changed",
      detail: "25566",
    });
    expect(diagFrom({ clientId: "friend", data }, "other")).toBeNull();
    expect(diagFrom({ clientId: "friend", data: { ...data, code: "nope" } }, "host")).toBeNull();
    expect(diagFrom({ data }, "host")).toBeNull();
    expect(diagFrom({ clientId: "friend", data: null }, "host")).toBeNull();
    const long = diagFrom({ clientId: "f", data: { ...data, detail: "x".repeat(500) } }, "host");
    expect(long?.detail).toHaveLength(200);
    expect(
      diagFrom({ clientId: "f", data: { to: "host", code: "joined" } }, "host")?.detail,
    ).toBeUndefined();
  });
});
