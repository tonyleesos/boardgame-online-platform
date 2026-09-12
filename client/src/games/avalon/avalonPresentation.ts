import type { Game } from "../../../../functions/src/shared/model";

export type ExpeditionStage = {
  id: string;
  kind: "ballot" | "battle" | "reveal" | "travel";
  game: Game;
  fromRound?: number;
};
export interface AvalonPresentation {
  observed: Game;
  queue: ExpeditionStage[];
}
function missionStage(game: Game, previous?: Game): ExpeditionStage {
  const round = game.missionResults.length;
  return {
    id: `${game.id}:mission:${round}`,
    kind: "battle",
    game: {
      ...game,
      round,
      leaderId: previous?.round === round ? previous.leaderId : game.leaderId,
      phase: "MISSION_RESULT",
      selectedPlayerIds: game.missionResults[round - 1].team,
      roles: undefined,
      winner: undefined,
      winReason: undefined,
    },
  };
}
function ballotStage(game: Game): ExpeditionStage {
  return {
    id: `${game.id}:ballot:${game.lastTeamVote?.revision ?? game.revision}`,
    kind: "ballot",
    game: {
      ...game,
      selectedPlayerIds: game.lastTeamVote!.team,
      roles: undefined,
      winner: undefined,
      winReason: undefined,
    },
  };
}
export function createAvalonPresentation(game: Game): AvalonPresentation {
  const queue: ExpeditionStage[] = [];
  if (game.phase === "MISSION_VOTE" && game.lastTeamVote)
    queue.push(ballotStage(game));
  if (game.phase === "MISSION_RESULT" && game.missionResults.length)
    queue.push(missionStage(game));
  return { observed: game, queue };
}
/** Presentation snapshots keep fast AI / remote updates from skipping a reveal. */
export function reconcileAvalonPresentation(
  state: AvalonPresentation,
  game: Game,
): AvalonPresentation {
  const previous = state.observed;
  if (game.id !== previous.id) return createAvalonPresentation(game);
  const queue = [...state.queue];
  const ballotChanged =
    game.lastTeamVote &&
    (game.lastTeamVote.revision !== previous.lastTeamVote?.revision ||
      JSON.stringify(game.lastTeamVote) !==
        JSON.stringify(previous.lastTeamVote) ||
      (previous.phase === "TEAM_VOTE" && game.phase !== "TEAM_VOTE"));
  if (ballotChanged) {
    // If an entire mission arrived in one snapshot, use a pre-mission view for
    // the ballot so the map/history cannot reveal the result during preparation.
    const ballotGame =
      game.missionResults.length > previous.missionResults.length
        ? {
            ...game,
            phase: "MISSION_VOTE" as const,
            round: game.missionResults.length,
            missionResults: game.missionResults.slice(0, -1),
          }
        : game;
    queue.push(
      ballotStage(
        previous.phase === "TEAM_VOTE"
          ? {
              ...ballotGame,
              leaderId: previous.leaderId,
              proposalAttempt: previous.proposalAttempt,
            }
          : ballotGame,
      ),
    );
  }
  const newMission =
    game.missionResults.length > previous.missionResults.length;
  // A finished game loaded as a catch-up snapshot goes straight to the ending.
  // A mission already being presented stays queued ahead of the ending.
  if (
    newMission &&
    (game.phase !== "GAME_OVER" ||
      previous.phase === "MISSION_VOTE" ||
      previous.phase === "MISSION_RESULT")
  )
    queue.push(missionStage(game, previous));
  if (
    game.round > previous.round &&
    game.phase !== "GAME_OVER" &&
    game.phase !== "ASSASSINATION"
  ) {
    queue.push({
      id: `${game.id}:travel:${game.round}`,
      kind: "travel",
      game,
      fromRound: previous.round,
    });
  }
  return { observed: game, queue };
}
export function finishAvalonStage(
  state: AvalonPresentation,
): AvalonPresentation {
  const [stage, ...rest] = state.queue;
  if (!stage) return state;
  return {
    ...state,
    queue:
      stage.kind === "battle" ? [{ ...stage, kind: "reveal" }, ...rest] : rest,
  };
}
