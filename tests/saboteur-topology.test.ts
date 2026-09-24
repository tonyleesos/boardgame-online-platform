import { describe, it, expect } from "vitest";
import {
  MINE_CARDS,
  cellKey,
  type MineBoard,
  type PathCard,
} from "../functions/src/shared/saboteur";
import {
  validatePathPlacement,
  reachableChannels,
  canTeamReachGold,
  countVisibleCrystals,
  reachableGoal,
  frontier,
} from "../functions/src/shared/mineTopology";
const card = (name: string) =>
  MINE_CARDS.find((c) => c.name === name) as PathCard;
const start = (): MineBoard => ({
  "0_0": { x: 0, y: 0, type: "start", cardId: "start", rotation: 0 },
});
const put = (
  b: MineBoard,
  x: number,
  y: number,
  name: string,
  rotation: 0 | 180 = 0,
) => {
  b[cellKey(x, y)] = { x, y, type: "path", cardId: card(name).id, rotation };
};
describe("mine channel topology", () => {
  it("extends a connected revealed goal, but never places a ladder beside it", () => {
    const b = start();
    b["1_0"] = {
      x: 1,
      y: 0,
      type: "goal",
      cardId: "goal-0",
      rotation: 180,
      revealed: "ROCK",
    };
    // The rock's rotated south/west corner connects from the entrance.
    expect(validatePathPlacement(b, card("南北礦道"), 1, 1, 0)).toBeNull();
    expect(frontier(b)).toContainEqual({ x: 1, y: 1 });
    expect(validatePathPlacement(b, card("升降梯"), 1, 1, 0)).toContain("目標");
  });
  it("requires adjacency, matching edges, and portrait rotation", () => {
    const b = start(),
      straight = card("東西礦道");
    expect(validatePathPlacement(b, straight, 1, 0, 0)).toBeNull();
    expect(validatePathPlacement(b, straight, 1, 0, 180)).toBeNull();
    expect(validatePathPlacement(b, straight, 1, 0, 90)).toContain("180");
    expect(validatePathPlacement(b, straight, 4, 0, 0)).not.toBeNull();
    expect(validatePathPlacement(b, straight, 0, -1, 0)).not.toBeNull();
    expect(validatePathPlacement(b, straight, 0, 0, 0)).not.toBeNull();
  });
  it.each(["跨越橋梁", "雙彎道"])(
    "%s keeps the two internal channels separate",
    (name) => {
      const b = start();
      put(b, 1, 0, name);
      const reached = reachableChannels(b);
      expect(reached.has("1_0:1")).toBe(true);
      expect(reached.has("1_0:0")).toBe(false);
      expect(validatePathPlacement(start(), card(name), 1, 0, 0)).toBeNull();
    },
  );
  it("dead ends cannot connect their other port to Start", () => {
    const b = start();
    put(b, 1, 0, "堵塞礦道");
    expect(validatePathPlacement(b, card("東西礦道"), 2, 0, 0)).not.toBeNull();
  });
  it("ladders reconnect remote paths, but cannot touch a goal", () => {
    const b = start();
    put(b, 6, 0, "東西礦道");
    put(b, 7, 0, "東西礦道");
    b["8_0"] = { x: 8, y: 0, type: "goal", cardId: "goal-1", rotation: 0 };
    expect(reachableGoal(b, "8_0")).toBe(false);
    expect(validatePathPlacement(b, card("升降梯"), 5, 0, 0)).toBeNull();
    put(b, 5, 0, "升降梯");
    expect(reachableGoal(b, "8_0")).toBe(true);
    expect(validatePathPlacement(b, card("升降梯"), 8, -1, 0)).toContain(
      "目標",
    );
  });
  it("doors affect team access, not physical placement; alternate routes count", () => {
    const b = start();
    put(b, 1, 0, "藍色門");
    expect(validatePathPlacement(b, card("東西礦道"), 2, 0, 0)).toBeNull();
    b["2_0"] = {
      x: 2,
      y: 0,
      type: "goal",
      cardId: "gold",
      rotation: 0,
      revealed: "GOLD",
    };
    expect(canTeamReachGold(b, "BLUE")).toBe(true);
    expect(canTeamReachGold(b, "GREEN")).toBe(false);
    put(b, 0, -1, "十字礦道");
    put(b, 1, -1, "十字礦道");
    put(b, 2, -1, "十字礦道");
    expect(canTeamReachGold(b, "GREEN")).toBe(true);
  });
  it("rockfall disconnects channels while isolated crystals still count", () => {
    const b = start();
    put(b, 1, 0, "東西礦道");
    put(b, 2, 0, "水晶礦道");
    expect(reachableChannels(b).has("2_0:0")).toBe(true);
    delete b["1_0"];
    expect(reachableChannels(b).has("2_0:0")).toBe(false);
    expect(countVisibleCrystals(b)).toBe(2);
    delete b["2_0"];
    expect(countVisibleCrystals(b)).toBe(0);
  });
  it("checks every touching edge and ignores hidden goal topology", () => {
    const b = start();
    put(b, 1, -1, "南北礦道");
    expect(validatePathPlacement(b, card("東西礦道"), 1, 0, 0)).not.toBeNull();
    const remote = start();
    put(remote, 6, 0, "升降梯");
    remote["8_0"] = { x: 8, y: 0, type: "goal", cardId: "goal-1", rotation: 0 };
    expect(validatePathPlacement(remote, card("東西礦道"), 7, 0, 0)).toBeNull();
  });
});
