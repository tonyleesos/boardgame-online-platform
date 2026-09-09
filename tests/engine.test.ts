import { describe, expect, it } from "vitest";
import { applyGameAction, startGame } from "../functions/src/engine";
import {
  calculateMissionResult,
  calculateTeamVote,
  getMissionTeamSize,
  getTeamCounts,
  rolesFor,
  sideOf,
} from "../functions/src/shared/rules";
import type {
  GameAction,
  MissionVote,
  Session,
} from "../functions/src/shared/model";
function setup(count = 5) {
  const ids = Array.from({ length: count }, (_, i) => `p${i}`);
  const session: Session = {
    public: {
      code: "ABC234",
      gameId: "avalon",
      hostId: ids[0],
      status: "waiting",
      createdAt: 1,
      players: Object.fromEntries(
        ids.map((uid) => [
          uid,
          { uid, nickname: uid, joinedAt: 1, ready: true },
        ]),
      ),
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startGame(session, "test-game", (a) => a);
  return session;
}
function action(s: Session, uid: string, a: GameAction) {
  return applyGameAction(s, uid, a);
}
function reveal(s: Session) {
  s.public.game!.order.forEach((id) => action(s, id, { type: "reveal" }));
}
function propose(s: Session, team?: string[]) {
  const g = s.public.game!;
  action(s, g.leaderId, {
    type: "select",
    players:
      team ?? g.order.slice(0, getMissionTeamSize(g.order.length, g.round)),
  });
  action(s, g.leaderId, { type: "propose" });
}
function approve(s: Session) {
  s.public.game!.order.forEach((id) =>
    action(s, id, { type: "teamVote", vote: "approve" }),
  );
}
function mission(s: Session, fail = false) {
  const g = s.public.game!;
  for (const id of g.selectedPlayerIds)
    action(s, id, {
      type: "missionVote",
      vote: fail && s.private[id].side === "evil" ? "fail" : "success",
    });
  action(s, g.leaderId, { type: "continue" });
}
describe("standard Avalon rules", () => {
  const cases = [
    [5, 3, 2, [2, 3, 2, 3, 3]],
    [6, 4, 2, [2, 3, 4, 3, 4]],
    [7, 4, 3, [2, 3, 3, 4, 4]],
    [8, 5, 3, [3, 4, 4, 5, 5]],
    [9, 6, 3, [3, 4, 4, 5, 5]],
    [10, 6, 4, [3, 4, 4, 5, 5]],
  ] as const;
  it.each(cases)(
    "%i player counts and all mission sizes",
    (count, good, evil, missions) => {
      expect(getTeamCounts(count)).toMatchObject({ good, evil });
      expect(rolesFor(count).filter((r) => sideOf(r) === "evil")).toHaveLength(
        evil,
      );
      missions.forEach((size, i) =>
        expect(getMissionTeamSize(count, i + 1)).toBe(size),
      );
    },
  );
  it.each([7, 8, 9, 10])(
    "mission 4 needs two failures for %i players",
    (count) => {
      expect(calculateMissionResult(["fail", "success"], count, 4)).toBe(
        "success",
      );
      expect(calculateMissionResult(["fail", "fail"], count, 4)).toBe("fail");
      expect(calculateMissionResult(["fail", "success"], count, 3)).toBe(
        "fail",
      );
    },
  );
  it("small games need only one fail on mission 4", () => {
    for (const count of [5, 6])
      expect(calculateMissionResult(["fail"], count, 4)).toBe("fail");
  });
  it("requires a strict majority; ties reject", () => {
    expect(calculateTeamVote(["approve", "reject"])).toBe(false);
    expect(calculateTeamVote(["approve", "approve", "reject"])).toBe(true);
  });
  it("rejects unsupported counts and rounds", () => {
    expect(() => rolesFor(4)).toThrow();
    expect(() => getMissionTeamSize(5, 6)).toThrow();
  });
});
describe("authoritative state machine and secrecy", () => {
  it("waits for everyone to reveal and gives correct private knowledge", () => {
    const s = setup();
    action(s, "p0", { type: "reveal" });
    expect(s.public.game!.phase).toBe("ROLE_REVEAL");
    expect(s.private.p0.knowledge.sort()).toEqual(["p3", "p4"]);
    expect(s.private.p1.knowledge.sort()).toEqual(["p0", "p4"]);
    expect(s.private.p2.knowledge).toEqual([]);
    expect(s.private.p3.knowledge).toEqual(["p4"]);
    expect(JSON.stringify(s.public)).not.toMatch(
      /merlin|assassin|morgana|knowledge/,
    );
    expect(() => action(s, "p0", { type: "reveal" })).toThrow();
  });
  it("rejects wrong phase, non-player, non-leader, duplicate and invalid teams", () => {
    const s = setup();
    expect(() => propose(s)).toThrow();
    reveal(s);
    expect(() =>
      action(s, "outsider", { type: "select", players: ["p0", "p1"] }),
    ).toThrow();
    expect(() =>
      action(s, "p1", { type: "select", players: ["p0", "p1"] }),
    ).toThrow();
    expect(() =>
      action(s, "p0", { type: "select", players: ["p0", "p0"] }),
    ).toThrow();
    expect(() =>
      action(s, "p0", { type: "select", players: ["p0", "p1", "p2"] }),
    ).toThrow();
    action(s, "p0", { type: "select", players: ["p1"] });
    expect(() => action(s, "p0", { type: "propose" })).toThrow();
  });
  it("keeps ballots private and rejects duplicate votes", () => {
    const s = setup();
    reveal(s);
    propose(s);
    action(s, "p0", { type: "teamVote", vote: "reject" });
    expect(s.public.game!.lastTeamVote).toBeUndefined();
    expect(JSON.stringify(s.public)).not.toContain("reject");
    expect(() =>
      action(s, "p0", { type: "teamVote", vote: "approve" }),
    ).toThrow();
    for (const id of ["p1", "p2", "p3", "p4"])
      action(s, id, { type: "teamVote", vote: "approve" });
    expect(s.public.game!.lastTeamVote?.votes.p0).toBe("reject");
    expect(s.public.game!.phase).toBe("MISSION_VOTE");
  });
  it("rotates leader and ends on the fifth rejected proposal", () => {
    const s = setup();
    reveal(s);
    for (let i = 0; i < 5; i++) {
      expect(s.public.game!.proposalAttempt).toBe(i + 1);
      expect(s.public.game!.leaderId).toBe(`p${i}`);
      propose(s);
      s.public.game!.order.forEach((id) =>
        action(s, id, { type: "teamVote", vote: "reject" }),
      );
    }
    expect(s.public.game).toMatchObject({ phase: "GAME_OVER", winner: "evil" });
  });
  it("prevents good Fail, non-member ballots, duplicate mission ballots, and leaks", () => {
    const s = setup();
    reveal(s);
    propose(s, ["p0", "p3"]);
    approve(s);
    expect(() =>
      action(s, "p0", { type: "missionVote", vote: "fail" }),
    ).toThrow();
    expect(() =>
      action(s, "p2", { type: "missionVote", vote: "success" }),
    ).toThrow();
    action(s, "p3", { type: "missionVote", vote: "fail" });
    expect(JSON.stringify(s.public)).not.toContain("fail");
    expect(() =>
      action(s, "p3", { type: "missionVote", vote: "success" }),
    ).toThrow();
    action(s, "p0", { type: "missionVote", vote: "success" });
    expect(s.public.game!.missionResults[0]).toMatchObject({
      result: "fail",
      fails: 1,
    });
    expect(s.secret.missionVotes).toEqual({});
  });
  it("ends after three failed missions", () => {
    const s = setup();
    reveal(s);
    for (let i = 0; i < 3; i++) {
      const g = s.public.game!;
      propose(s, [
        "p3",
        ...g.order
          .filter((id) => id !== "p3")
          .slice(0, getMissionTeamSize(5, g.round) - 1),
      ]);
      approve(s);
      mission(s, true);
    }
    expect(s.public.game).toMatchObject({ phase: "GAME_OVER", winner: "evil" });
  });
  it.each([
    ["p0", "evil"],
    ["p2", "good"],
  ] as const)(
    "three successes lead to assassination: target %s wins %s",
    (target, winner) => {
      const s = setup();
      reveal(s);
      for (let i = 0; i < 3; i++) {
        propose(s);
        approve(s);
        mission(s);
      }
      expect(s.public.game!.phase).toBe("ASSASSINATION");
      expect(() =>
        action(s, "p0", { type: "assassinate", target: "p0" }),
      ).toThrow();
      action(s, "p3", { type: "assassinate", target });
      expect(s.public.game).toMatchObject({ phase: "GAME_OVER", winner });
      expect(Object.keys(s.public.game!.roles!)).toHaveLength(5);
    },
  );
  it("resets proposal counter after a mission and rotates leader", () => {
    const s = setup();
    reveal(s);
    propose(s);
    s.public.game!.order.forEach((id) =>
      action(s, id, { type: "teamVote", vote: "reject" }),
    );
    propose(s);
    approve(s);
    mission(s);
    expect(s.public.game).toMatchObject({
      round: 2,
      leaderId: "p2",
      proposalAttempt: 1,
    });
  });
  it("normalizes Firebase omitted empty arrays and maps", () => {
    const s = setup();
    reveal(s);
    const g = s.public.game!;
    delete (g as Partial<typeof g>).selectedPlayerIds;
    delete (g as Partial<typeof g>).missionResults;
    delete (g as Partial<typeof g>).submitted;
    propose(s);
    approve(s);
    mission(s);
    expect(g.round).toBe(2);
  });
  it("rejects forged vote values", () => {
    const s = setup();
    reveal(s);
    propose(s);
    approve(s);
    expect(() =>
      action(s, "p0", { type: "missionVote", vote: "hacked" as MissionVote }),
    ).toThrow();
  });
});
