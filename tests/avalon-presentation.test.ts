import { describe, expect, it } from "vitest";
import type { Game } from "../functions/src/shared/model";
import {
  createAvalonPresentation,
  reconcileAvalonPresentation,
  finishAvalonStage,
} from "../client/src/games/avalon/avalonPresentation";

function game(patch: Partial<Game> = {}): Game {
  return {
    id: "quest",
    revision: 10,
    phase: "TEAM_VOTE",
    round: 1,
    leaderId: "a",
    order: ["a", "b", "c", "d", "e"],
    selectedPlayerIds: ["a", "b"],
    proposalAttempt: 1,
    missionResults: [],
    submitted: {},
    revealed: {},
    ...patch,
  };
}
const ballot = {
  revision: 15,
  approved: true,
  votes: {
    a: "approve",
    b: "reject",
    c: "approve",
    d: "approve",
    e: "approve",
  },
  team: ["a", "b"],
} as const;
const approved = () =>
  game({
    phase: "MISSION_VOTE",
    revision: 15,
    lastTeamVote: { ...ballot, team: [...ballot.team] },
  });
const completed = () => ({
  ...approved(),
  phase: "MISSION_RESULT" as const,
  revision: 17,
  missionResults: [{ result: "success" as const, fails: 0, team: ["a", "b"] }],
});

describe("Avalon presentation sequence", () => {
  it("does not reveal ballots while players are still submitting", () => {
    const state = reconcileAvalonPresentation(
      createAvalonPresentation(game()),
      game({ revision: 11, submitted: { a: true } }),
    );
    expect(state.queue).toEqual([]);
  });
  it("preserves preparation, battle and result in order when AI finishes early", () => {
    let state = reconcileAvalonPresentation(
      createAvalonPresentation(game()),
      approved(),
    );
    state = reconcileAvalonPresentation(state, completed());
    expect(state.queue.map((s) => s.kind)).toEqual(["ballot", "battle"]);
    expect(state.queue[0].game.missionResults).toHaveLength(0);
    state = finishAvalonStage(state);
    expect(state.queue[0].kind).toBe("battle");
    state = finishAvalonStage(state);
    expect(state.queue[0].kind).toBe("reveal");
    expect(state.queue[0].game.round).toBe(1);
  });
  it("waits for the result to be dismissed before walking to the next region", () => {
    let state = createAvalonPresentation(completed());
    state = reconcileAvalonPresentation(state, {
      ...completed(),
      phase: "TEAM_SELECTION",
      round: 2,
      revision: 18,
      selectedPlayerIds: [],
    });
    expect(state.queue.map((s) => s.kind)).toEqual(["battle", "travel"]);
    state = finishAvalonStage(state);
    expect(state.queue[0].game.round).toBe(1);
    state = finishAvalonStage(state);
    expect(state.queue[0]).toMatchObject({ kind: "travel", fromRound: 1 });
    expect(state.queue[0].game.round).toBe(2);
    expect(finishAvalonStage(state).queue).toEqual([]);
  });
  it("does not restart the countdown on ordinary database updates", () => {
    const state = createAvalonPresentation(approved());
    const next = reconcileAvalonPresentation(state, {
      ...approved(),
      revision: 16,
      submitted: { b: true },
    });
    expect(next.queue).toHaveLength(1);
    expect(next.queue[0]).toBe(state.queue[0]);
  });
  it("keeps the original captain and proposal on rejected-ballot seats", () => {
    const before = game({ proposalAttempt: 2 });
    const next = reconcileAvalonPresentation(createAvalonPresentation(before), {
      ...approved(),
      phase: "TEAM_SELECTION",
      leaderId: "b",
      proposalAttempt: 3,
      lastTeamVote: { ...approved().lastTeamVote!, approved: false },
    });
    expect(next.queue[0].game.leaderId).toBe("a");
    expect(next.queue[0].game.proposalAttempt).toBe(2);
  });
  it("recognizes consecutive identical ballots by their completion revision", () => {
    let state = createAvalonPresentation(approved());
    state = finishAvalonStage(state);
    state = reconcileAvalonPresentation(state, {
      ...approved(),
      lastTeamVote: { ...approved().lastTeamVote!, revision: 25 },
    });
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].id).toContain(":25");
  });
  it("conceals a result even when ballot and mission arrive in one snapshot", () => {
    const state = reconcileAvalonPresentation(
      createAvalonPresentation(game()),
      completed(),
    );
    expect(state.queue.map((s) => s.kind)).toEqual(["ballot", "battle"]);
    expect(state.queue[0].game.missionResults).toEqual([]);
  });
  it("keeps a queued mission ahead of a fast ending without leaking roles", () => {
    let state = createAvalonPresentation(completed());
    state = reconcileAvalonPresentation(state, {
      ...completed(),
      phase: "GAME_OVER",
      winner: "evil",
      roles: { a: "merlin" },
    });
    expect(state.queue[0].game.roles).toBeUndefined();
    expect(state.queue[0].game.winner).toBeUndefined();
    expect(finishAvalonStage(state).queue[0].kind).toBe("reveal");
  });
  it("resumes preparation on reconnect and resets presentation for a rematch", () => {
    const state = createAvalonPresentation(approved());
    expect(state.queue[0].kind).toBe("ballot");
    expect(
      createAvalonPresentation({ ...completed(), phase: "GAME_OVER" }).queue,
    ).toEqual([]);
    expect(
      reconcileAvalonPresentation(
        state,
        game({ id: "new", phase: "ROLE_REVEAL" }),
      ).queue,
    ).toEqual([]);
  });
});
