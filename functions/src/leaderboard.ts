import type { Room, Session } from "./shared/model";
import { sideOf } from "./shared/rules";
import {
  emptyWins,
  RANKED_GAMES,
  type RankedGame,
  type LeaderboardEntry,
  type GameSettlement,
} from "./shared/leaderboard";

export interface WinResult {
  matchId: string;
  gameId: RankedGame;
  winners: Array<{ uid: string; nickname: string }>;
}
export interface PlayerStats extends LeaderboardEntry {
  updatedAt: number;
}

/** Only the authoritative finished snapshot determines winners, even after a rematch/deletion. */
export function winningPlayers(room: Room): WinResult | null {
  if (
    room.status !== "finished" ||
    room.mode === "practice" ||
    !RANKED_GAMES.includes(room.gameId as RankedGame)
  )
    return null;
  let matchId: string | undefined;
  let winners: string[] = [];
  switch (room.gameId) {
    case "avalon": {
      const g = room.game;
      if (!g?.winner || g.phase !== "GAME_OVER") return null;
      matchId = g.id;
      winners = g.order.filter(
        (uid) => g.roles?.[uid] && sideOf(g.roles[uid]) === g.winner,
      );
      break;
    }
    case "timebomb":
    case "timebomb-classic": {
      const g = room.timebomb;
      if (!g?.winner || g.phase !== "GAME_OVER") return null;
      matchId = g.id;
      winners = g.order.filter(
        (uid) =>
          g.roles?.[uid] === (g.winner === "good" ? "sherlock" : "moriarty"),
      );
      break;
    }
    case "decorum": {
      const g = room.decorum;
      if (
        g?.winner !== "players" ||
        g.phase !== "GAME_OVER" ||
        g.endReason !== "all-fulfilled"
      )
        return null;
      matchId = g.id;
      winners = g.playerOrder;
      break;
    }
    case "splendor": {
      const g = room.splendor;
      if (!g || g.aborted || g.phase !== "GAME_OVER") return null;
      matchId = g.id;
      winners = g.winners ?? [];
      break;
    }
    case "mafia-de-cuba": {
      const g = room.mafia;
      if (!g || g.winReason === "ABORTED" || g.phase !== "GAME_OVER")
        return null;
      matchId = g.id;
      winners = g.winners ?? [];
      break;
    }
  }
  if (!matchId) return null;
  return {
    matchId,
    gameId: room.gameId as RankedGame,
    winners: [...new Set(winners)].flatMap((uid) => {
      const player = room.players[uid];
      return player && !player.isBot && !player.isProxy
        ? [{ uid, nickname: player.nickname }]
        : [];
    }),
  };
}

/** The outbox and finished state share the RTDB room transaction. No network side effects here. */
export function queueSettlement(
  before: Session,
  after: Session | null,
  completedAt: number,
): Session | null {
  if (before.public.status !== "playing" || after?.public.status !== "finished")
    return after;
  const result = winningPlayers(after.public);
  if (result?.winners.length) {
    after.settlements ??= {};
    after.settlements[result.matchId] ??= {
      ...result,
      completedAt,
    } satisfies GameSettlement;
  }
  return after;
}

/** Deduplication lives in a separate Firestore match document, never in this summary. */
export function creditWin(
  current: PlayerStats | null,
  result: WinResult,
  player: WinResult["winners"][number],
  timestamp: number,
): PlayerStats {
  const wins = { ...emptyWins(), ...current?.wins };
  wins[result.gameId]++;
  return {
    uid: player.uid,
    nickname:
      current && current.updatedAt > timestamp
        ? current.nickname
        : player.nickname,
    wins,
    totalWins: RANKED_GAMES.reduce((sum, id) => sum + wins[id], 0),
    updatedAt: Math.max(current?.updatedAt ?? 0, timestamp),
  };
}

export function publicStats(value: PlayerStats): LeaderboardEntry {
  return {
    uid: value.uid,
    nickname: value.nickname,
    totalWins: value.totalWins,
    wins: { ...emptyWins(), ...value.wins },
  };
}
