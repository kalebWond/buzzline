import { fixtures } from "@buzzline/shared/fixtures";
import { describe, expect, it } from "vitest";
import { rankOf, screenFor } from "./screenFor";

describe("screenFor", () => {
  it("shows join without state or identity", () => {
    expect(screenFor(null, null)).toBe("join");
    expect(screenFor(fixtures.lobby, null)).toBe("join");
    expect(screenFor(null, "p1")).toBe("join");
  });
  it("shows join when the player is not in the game", () => {
    expect(screenFor(fixtures.lobby, "nobody")).toBe("join");
  });
  it("maps each phase", () => {
    expect(screenFor(fixtures.lobby, "p1")).toBe("waiting");
    expect(screenFor(fixtures.reveal, "p1")).toBe("reveal");
    expect(screenFor(fixtures.finished, "p1")).toBe("finished");
  });
  it("splits question into answer and locked by answered flag", () => {
    expect(screenFor(fixtures.question, "p2")).toBe("answer");
    expect(screenFor(fixtures.question, "p1")).toBe("locked");
  });
});

describe("rankOf", () => {
  it("ranks by score", () => {
    expect(rankOf(fixtures.finished, "p1")).toBe(1);
    expect(rankOf(fixtures.finished, "p2")).toBe(2);
  });
  it("shares rank on ties", () => {
    expect(rankOf(fixtures.lobby, "p2")).toBe(1);
  });
  it("returns 0 for unknown player", () => {
    expect(rankOf(fixtures.lobby, "x")).toBe(0);
  });
});
