import { describe, it, expect } from "vitest";
import { applyHouseAction, startDecorum, applyDecorumAction, recalculateDecorum } from "../functions/src/decorum/engine";
import { evaluateCondition, evaluatePlayerConditions } from "../functions/src/shared/decorum-conditions";
import { decorumScenarios } from "../functions/src/decorum/scenarios";
import { DECOR_OBJECTS, normalizeDecorum } from "../functions/src/shared/decorum";
import type { ConditionExpression, HouseState, HouseAction } from "../functions/src/shared/decorum";
import type { Session } from "../functions/src/shared/model";
import { leaveSeat } from "../functions/src/membership";
import { solutionMoves } from "./decorum-solutions";

function setup(count = 2, scenarioId?: string, ready = true, assignment?: number[]) {
  const s: Session = { public: { code: "DCR234", gameId: "decorum", hostId: "p0", status: "waiting", createdAt: 1,
    ...(scenarioId ? { decorumScenarioId: scenarioId } : {}),
    players: Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, { uid: `p${i}`, nickname: `Player ${i}`, joinedAt: i, ready: true }])) },
    private: {}, secret: { teamVotes: {}, missionVotes: {} } };
  startDecorum(s, "decor-test", (a) => assignment ? assignment.map((i) => a[i]) : a);
  if (ready) s.public.decorum!.playerOrder.forEach((uid) => applyDecorumAction(s, uid, { type: "decorReady" }));
  return s;
}
const house = () => structuredClone(decorumScenarios[0].initialHouse);
function turn(s: Session, action: HouseAction) {
  const g = s.public.decorum!;
  const actor = g.playerOrder[g.currentPlayerIndex];
  applyDecorumAction(s, actor, action);
  if (g.phase === "REACTION") for (const uid of g.playerOrder.filter((id) => id !== actor)) applyDecorumAction(s, uid, { type: "decorReact", reaction: "neutral" });
}
describe("Decorum house actions", () => {
  it("adds only to an empty matching slot and keeps input immutable", () => {
    const h = house();
    const next = applyHouseAction(h, { type: "decorAdd", roomId: "bath", objectId: "lamp-blue-modern" }, "p0", false, false);
    expect(next.rooms[0].objects.lamp?.color).toBe("blue");
    expect(h.rooms[0].objects.lamp).toBeNull();
    expect(() => applyHouseAction(next, { type: "decorAdd", roomId: "bath", objectId: "lamp-yellow-retro" }, "p0", false, false)).toThrow();
  });
  it("removes, rejects absent objects, and swaps within one object type", () => {
    const h = house();
    expect(() => applyHouseAction(h, { type: "decorSwap", roomId: "living", objectId: "art-red-modern" }, "p0", false, false)).toThrow();
    const next = applyHouseAction(h, { type: "decorSwap", roomId: "living", objectId: "lamp-blue-modern" }, "p0", false, false);
    expect(next.rooms[2].objects.lamp?.id).toBe("lamp-blue-modern");
    const removed = applyHouseAction(next, { type: "decorRemove", roomId: "living", objectType: "lamp" }, "p0", false, false);
    expect(removed.rooms[2].objects.lamp).toBeNull();
    expect(() => applyHouseAction(removed, { type: "decorRemove", roomId: "living", objectType: "lamp" }, "p0", false, false)).toThrow();
  });
  it("repaints one room and rejects unknown rooms, catalog IDs and unchanged colors", () => {
    const h = house();
    expect(applyHouseAction(h, { type: "decorPaint", roomId: "bed", color: "blue" }, "p0", false, false).rooms[1].wallColor).toBe("blue");
    for (const action of [{ type: "decorPaint", roomId: "no", color: "blue" }, { type: "decorPaint", roomId: "bed", color: "red" }, { type: "decorAdd", roomId: "bath", objectId: "invented" }] as HouseAction[]) expect(() => applyHouseAction(h, action, "p0", false, false)).toThrow();
  });
  it("only satisfied players may pass", () => {
    expect(() => applyHouseAction(house(), { type: "decorPass" }, "p0", false, false)).toThrow();
    expect(applyHouseAction(house(), { type: "decorPass" }, "p0", true, false)).toEqual(house());
    const s = setup(); s.public.decorum!.playerFulfilled.p0 = true;
    expect(() => applyDecorumAction(s, "p0", { type: "decorPass" })).toThrow();
  });
  it("validates roommate destination, occupancy and displacement", () => {
    const s = setup(4); const h = s.public.decorum!.house;
    expect(() => applyHouseAction(h, { type: "decorRoommate", roomId: "living" }, "p0", false, true)).toThrow();
    expect(() => applyHouseAction(h, { type: "decorRoommate", roomId: "bed" }, "p0", false, true)).toThrow();
    expect(() => applyHouseAction(h, { type: "decorRoommate", roomId: "bed", swapWith: "p1" }, "p0", false, true)).toThrow();
    const next = applyHouseAction(h, { type: "decorRoommate", roomId: "bed", swapWith: "p2" }, "p0", false, true);
    expect(next.roommates).toMatchObject({ p0: "bed", p2: "bath" });
    expect(() => applyHouseAction(h, { type: "decorRoommate", roomId: "bed", swapWith: "p2" }, "p0", false, false)).toThrow();
  });
});
describe("Decorum condition expressions", () => {
  const cases: Array<[ConditionExpression, boolean]> = [
    [{ kind: "roomHasObject", room: "living", match: { type: "lamp", style: "antique" } }, true],
    [{ kind: "roomHasNoObject", room: "bath", match: { type: "lamp" } }, true],
    [{ kind: "roomHasNoObject", room: "missing", match: {} }, false],
    [{ kind: "objectCount", comparison: "eq", value: 4 }, true],
    [{ kind: "colorCount", color: "red", target: "walls", comparison: "eq", value: 4 }, true],
    [{ kind: "colorCount", color: "red", target: "both", comparison: "eq", value: 6 }, true],
    [{ kind: "colorCount", color: "yellow", target: "objects", comparison: "lte", value: 1 }, true],
    [{ kind: "styleCount", style: "antique", comparison: "eq", value: 2 }, true],
    [{ kind: "emptySlotCount", comparison: "eq", value: 8 }, true],
    [{ kind: "emptySlotCount", scope: { ids: ["bath", "bed"] }, comparison: "eq", value: 4 }, true],
    [{ kind: "distinctCount", trait: "color", target: "walls", comparison: "eq", value: 1 }, true],
    [{ kind: "distinctCount", trait: "color", target: "objects", comparison: "eq", value: 3 }, true],
    [{ kind: "distinctCount", trait: "color", target: "both", comparison: "eq", value: 3 }, true],
    [{ kind: "distinctCount", trait: "style", target: "objects", comparison: "eq", value: 3 }, true],
    [{ kind: "distinctCount", trait: "style", target: "objects", comparison: "eq", value: 4 }, false],
    [{ kind: "everyRoom", condition: { kind: "emptySlotCount", comparison: "eq", value: 2 } }, true],
    [{ kind: "leftSide", condition: { kind: "distinctCount", trait: "style", target: "objects", comparison: "eq", value: 2 } }, true],
    [{ kind: "roomColor", room: "bed", color: "yellow" }, false],
    [{ kind: "everyRoom", condition: { kind: "objectCount", comparison: "gte", value: 1 } }, true],
    [{ kind: "someRoom", condition: { kind: "roomHasObject", room: "$room", match: { type: "curio" } } }, true],
    [{ kind: "leftSide", condition: { kind: "objectCount", comparison: "eq", value: 2 } }, true],
    [{ kind: "rightSide", condition: { kind: "styleCount", style: "retro", comparison: "eq", value: 1 } }, true],
    [{ kind: "sameRoom", first: { type: "lamp" }, second: { type: "curio" } }, false],
    [{ kind: "differentRoom", first: { type: "lamp" }, second: { type: "curio" } }, true],
    [{ kind: "wallColors", first: "bed", second: "living", same: false }, false],
    [{ kind: "and", conditions: [{ kind: "roomColor", room: "bed", color: "red" }, { kind: "not", condition: { kind: "roomColor", room: "bed", color: "blue" } }] }, true],
    [{ kind: "or", conditions: [{ kind: "roomColor", room: "bed", color: "blue" }, { kind: "roomColor", room: "bed", color: "yellow" }] }, false],
  ];
  it.each(cases)("evaluates %j", (expression, expected) => expect(evaluateCondition(expression, house())).toBe(expected));
  it("evaluates bedroom references in the condition owner's context", () => {
    const s = setup(4); const h = s.public.decorum!.house;
    h.rooms[0].wallColor = "blue";
    expect(evaluateCondition({ kind: "roomColor", room: "$bedroom", color: "blue" }, h, { ownerId: "p0" })).toBe(true);
    expect(evaluateCondition({ kind: "roomColor", room: "$bedroom", color: "blue" }, h, { ownerId: "p2" })).toBe(false);
  });
  it("counts elided object slots as empty and does not count walls as objects", () => {
    const h = house();
    delete (h.rooms[0] as Partial<typeof h.rooms[0]>).objects;
    expect(evaluateCondition({ kind: "emptySlotCount", scope: { ids: ["bath"] }, comparison: "eq", value: 3 }, h)).toBe(true);
    expect(evaluateCondition({ kind: "distinctCount", scope: { ids: ["bath"] }, trait: "color", target: "objects", comparison: "eq", value: 0 }, h)).toBe(true);
    expect(evaluateCondition({ kind: "distinctCount", scope: { ids: ["bath"] }, trait: "color", target: "both", comparison: "eq", value: 1 }, h)).toBe(true);
  });
});
describe("Decorum state machine", () => {
  it("enforces setup, ownership, phase and one reaction per non-active player", () => {
    const s = setup(3, undefined, false);
    expect(() => applyDecorumAction(s, "p0", { type: "decorPaint", roomId: "bed", color: "blue" })).toThrow();
    for (const id of ["p0", "p1", "p2"]) applyDecorumAction(s, id, { type: "decorReady" });
    expect(() => applyDecorumAction(s, "outsider", { type: "decorPass" })).toThrow();
    expect(() => applyDecorumAction(s, "p1", { type: "decorPaint", roomId: "bed", color: "blue" })).toThrow();
    applyDecorumAction(s, "p0", { type: "decorPaint", roomId: "bed", color: "blue" });
    expect(() => applyDecorumAction(s, "p0", { type: "decorReact", reaction: "neutral" })).toThrow();
    applyDecorumAction(s, "p1", { type: "decorReact", reaction: "positive" });
    expect(s.public.decorum!.phase).toBe("REACTION");
    expect(() => applyDecorumAction(s, "p1", { type: "decorReact", reaction: "negative" })).toThrow();
    applyDecorumAction(s, "p2", { type: "decorReact", reaction: "negative" });
    expect(s.public.decorum!.currentPlayerIndex).toBe(1);
    expect(s.public.decorum!.lastReactions).toEqual({ p1: "positive", p2: "negative" });
  });
  it("recomputes satisfaction and can make a satisfied player unsatisfied again", () => {
    const s = setup();
    s.decorumPrivate!.p0.conditions = [{ id: "green", description: "green", evaluator: { kind: "roomColor", room: "living", color: "green" } }];
    turn(s, { type: "decorPaint", roomId: "living", color: "green" });
    expect(s.public.decorum!.playerFulfilled.p0).toBe(true);
    turn(s, { type: "decorPaint", roomId: "living", color: "blue" });
    expect(s.public.decorum!.playerFulfilled.p0).toBe(false);
  });
  it.each([2, 3, 4])("fails at round 30 with %i players without a sixth meeting", (count) => {
    const s = setup(count); const g = s.public.decorum!;
    g.round = 30; g.currentPlayerIndex = count - 1;
    turn(s, { type: "decorPaint", roomId: "living", color: "yellow" });
    expect(g.phase).toBe("GAME_OVER"); expect(g.endReason).toBe("round-limit");
    expect(Object.keys(g.revealedConditions!)).toHaveLength(count);
  });
  it.each([15, 20, 25])("two-player heart-to-heart follows round %i", (round) => {
    const s = setup(); const g = s.public.decorum!;
    g.round = round; g.currentPlayerIndex = 1;
    turn(s, { type: "decorPaint", roomId: "living", color: "yellow" });
    expect(g.phase).toBe("HEART_TO_HEART");
    for (const uid of g.playerOrder) applyDecorumAction(s, uid, { type: "decorShare", conditionId: s.decorumPrivate![uid].conditions[0].id, recipientId: uid === "p0" ? "p1" : "p0", status: "neutral" });
    expect(g.heartsRemaining).toBe(2); expect(g.round).toBe(round + 1); expect(g.phase).toBe("PLAYER_ACTION");
    expect(s.decorumPrivate!.p1.sharedConditionsReceived).toHaveLength(1);
  });
  it.each([2, 3, 4])("completes all scheduled meetings for %i players", (count) => {
    const s = setup(count); const g = s.public.decorum!;
    const rounds: number[] = [];
    while (g.phase !== "GAME_OVER") {
      if (g.phase === "HEART_TO_HEART" || g.phase === "HOUSE_MEETING") {
        rounds.push(g.round);
        for (const [i, uid] of g.playerOrder.entries()) {
          const own = s.decorumPrivate![uid];
          const condition = own.conditions.find((c) => !own.sharedConditionIds.includes(c.id)) ?? own.conditions[0];
          applyDecorumAction(s, uid, { type: "decorShare", conditionId: condition.id, recipientId: g.playerOrder[(i + 1) % count], status: "neutral" });
        }
      } else turn(s, { type: "decorPaint", roomId: "living", color: g.house.rooms[2].wallColor === "yellow" ? "red" : "yellow" });
    }
    expect(rounds).toEqual(count === 2 ? [15, 20, 25] : [5, 10, 15, 20, 25]);
    expect(g.heartsRemaining).toBe(0);
  });
  it("private sharing is asymmetric, can be reassigned, and rejects forged ownership", () => {
    const s = setup(4); const g = s.public.decorum!; g.phase = "HOUSE_MEETING";
    const cid = s.decorumPrivate!.p0.conditions[0].id;
    expect(() => applyDecorumAction(s, "p0", { type: "decorShare", conditionId: "invented", recipientId: "p1", status: "neutral" })).toThrow();
    expect(() => applyDecorumAction(s, "p0", { type: "decorShare", conditionId: cid, recipientId: "p0", status: "neutral" })).toThrow();
    applyDecorumAction(s, "p0", { type: "decorShare", conditionId: cid, recipientId: "p1", status: "positive" });
    expect(s.decorumPrivate!.p1.sharedConditionsReceived[0].ownerId).toBe("p0");
    expect(s.decorumPrivate!.p2.sharedConditionsReceived).toHaveLength(0);
    expect(JSON.stringify(g)).not.toContain(cid);
    g.meetingSubmitted = {};
    applyDecorumAction(s, "p0", { type: "decorShare", conditionId: cid, recipientId: "p2", status: "neutral" });
    expect(s.decorumPrivate!.p1.sharedConditionsReceived).toHaveLength(0);
    expect(s.decorumPrivate!.p2.sharedConditionsReceived).toHaveLength(1);
  });
  it("handles RTDB null elision and explicit leave without bot deadlock", () => {
    const s = setup(); const g = s.public.decorum!;
    delete (g.house.rooms[0] as Partial<typeof g.house.rooms[0]>).objects;
    expect(normalizeDecorum(g).house.rooms[0].objects.lamp).toBeNull();
    delete (s as Partial<Session>).secret;
    g.phase = "HEART_TO_HEART";
    applyDecorumAction(s, "p0", { type: "decorShare", conditionId: s.decorumPrivate!.p0.conditions[0].id, recipientId: "p1", status: "neutral" });
    expect(s.decorumPrivate!.p1.sharedConditionsReceived).toHaveLength(1);
    leaveSeat(s, "p0");
    expect(g.endReason).toBe("player-left"); expect(s.public.hostId).toBe("p1");
    expect(s.public.players.p1.isBot).toBeUndefined();
  });
  it("does not publish arbitrary extra action properties", () => {
    const s = setup();
    applyDecorumAction(s, "p0", { type: "decorPaint", roomId: "bed", color: "blue", message: "hidden information", winner: "players" } as HouseAction);
    expect(s.public.decorum!.latestAction!.action).toEqual({ type: "decorPaint", roomId: "bed", color: "blue" });
    expect(s.public.decorum!.winner).toBeUndefined();
  });
});
describe("original scenarios", () => {
  function permutations(items: number[]): number[][] {
    return items.length ? items.flatMap((item, i) => permutations(items.filter((_, j) => j !== i)).map((rest) => [item, ...rest])) : [[]];
  }
  it.each(decorumScenarios)("$id can be won through legal turns under every condition assignment", (scenario) => {
    for (const assignment of permutations(Array.from({ length: scenario.playerCount }, (_, i) => i))) {
      const s = setup(scenario.playerCount, scenario.id, true, assignment);
      const g = s.public.decorum!;
      for (const uid of g.playerOrder) {
        const conditions = s.decorumPrivate![uid].conditions;
        expect(conditions.length).toBe(scenario.difficulty === 2 ? 4 : 5);
        expect(new Set(conditions.map((c) => c.id)).size).toBe(conditions.length);
        expect(evaluatePlayerConditions(conditions, g.house, { ownerId: uid }).results.filter((r) => !r.fulfilled).length).toBeGreaterThanOrEqual(2);
        expect(JSON.stringify(g)).not.toContain(conditions[0].description);
      }
      for (const action of solutionMoves[scenario.id]) turn(s, action);
      expect(g.winner, assignment.join(",")).toBe("players");
      expect(g.round).toBeLessThan(g.maxRounds);
      expect(g.fulfilledConditionCount).toBe(g.totalConditionCount);
      if (scenario.enableRoommateTokens) {
        // Even moving to share with a different condition owner cannot make the
        // bedroom wishes mutually exclusive in this complete house.
        for (const swapWith of ["p2", "p3"]) {
          const moved = applyHouseAction(g.house, { type: "decorRoommate", roomId: "bed", swapWith }, "p0", true, true);
          for (const uid of g.playerOrder) expect(evaluatePlayerConditions(s.decorumPrivate![uid].conditions, moved, { ownerId: uid }).fulfilled).toBe(true);
        }
      }
    }
  });
  it.each(decorumScenarios)("$id has a verified solution and correct immediate victory", (scenario) => {
    const s = setup(scenario.playerCount, scenario.id); const g = s.public.decorum!;
    let h: HouseState = g.house;
    for (const action of solutionMoves[scenario.id]) h = applyHouseAction(h, action, action.type === "decorRoommate" ? "p1" : "p0", false, !!scenario.enableRoommateTokens);
    for (const uid of g.playerOrder) expect(evaluatePlayerConditions(s.decorumPrivate![uid].conditions, h, { ownerId: uid }).fulfilled, uid).toBe(true);
    g.house = h; recalculateDecorum(s);
    expect(g.phase).toBe("GAME_OVER"); expect(g.winner).toBe("players"); expect(g.fulfilledConditionCount).toBe(g.totalConditionCount);
    expect(g.score).toBe(3 * g.totalConditionCount! + 2 * g.heartsRemaining);
  });
  it("has an explicit catalog and no duplicate IDs", () => expect(new Set(DECOR_OBJECTS.map((o) => o.id)).size).toBe(DECOR_OBJECTS.length));
});
