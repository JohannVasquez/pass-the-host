import { describe, it, expect } from "vitest";
import { answerFrom, offerFor } from "@renderer/contexts/p2p-tunnel/infrastructure/signaling";

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
    expect(offerFor({ clientId: "friend", data: { peerId: "p1", sdp: "s" } }, "host")).not.toBeNull();
    expect(offerFor({ clientId: "friend", data: { ...data, sdp: 1 } }, "host")).toBeNull();
    expect(offerFor({ clientId: "friend", data: null }, "host")).toBeNull();
  });
});
