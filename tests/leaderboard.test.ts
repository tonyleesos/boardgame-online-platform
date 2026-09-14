import { describe, expect, it } from "vitest";
import {
  creditWin,
  publicStats,
  winningPlayers,
  queueSettlement,
} from "../functions/src/leaderboard";
import { startGame } from "../functions/src/engine";
import { startBomb } from "../functions/src/timebomb-engine";
import { startDecorum, finishDecorum } from "../functions/src/decorum/engine";
import { startSplendorGame } from "../functions/src/splendor/engine";
import { startMafia } from "../functions/src/mafia/engine";
import { sideOf } from "../functions/src/shared/rules";
import type { Session } from "../functions/src/shared/model";

function setup(gameId = "avalon", count = 5): Session {
  return {
    public: {
      code: "ABC234",
      gameId,
      hostId: "p0",
      status: "waiting",
      createdAt: 1,
      players: Object.fromEntries(
        Array.from({ length: count }, (_, i) => [
          `p${i}`,
          { uid: `p${i}`, nickname: `玩家${i}`, joinedAt: i, ready: true },
        ]),
      ),
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
}
const same = <T>(items: T[]) => items;
function avalon() {
  const s = setup();
  startGame(s, "match-1", same);
  Object.assign(s.public.game!, {
    phase: "GAME_OVER",
    winner: "good",
    roles: Object.fromEntries(
      Object.entries(s.private).map(([uid, p]) => [uid, p.role]),
    ),
  });
  s.public.status = "finished";
  return s;
}
describe("leaderboard settlement", () => {
  it.each(["good", "evil"] as const)(
    "credits every Avalon %s winner",
    (side) => {
      const s = avalon();
      s.public.game!.winner = side;
      expect(winningPlayers(s.public)!.winners.map((p) => p.uid)).toEqual(
        s.public.game!.order.filter(
          (uid) => sideOf(s.private[uid].role) === side,
        ),
      );
    },
  );
  it.each(["classic", "evolution"] as const)(
    "separates Time Bomb %s victories",
    (variant) => {
      const s = setup(
        variant === "classic" ? "timebomb-classic" : "timebomb",
        4,
      );
      startBomb(s, "bomb-1", same, variant);
      Object.assign(s.public.timebomb!, {
        phase: "GAME_OVER",
        winner: "evil",
        roles: Object.fromEntries(
          Object.entries(s.timebombPrivate!).map(([uid, p]) => [uid, p.role]),
        ),
      });
      s.public.status = "finished";
      const result = winningPlayers(s.public)!;
      expect(result.gameId).toBe(s.public.gameId);
      expect(result.winners.map((p) => p.uid)).toEqual(
        s.public.timebomb!.order.filter(
          (uid) => s.timebombPrivate![uid].role === "moriarty",
        ),
      );
    },
  );
  it("credits all cooperative winners and excludes failures/aborts", () => {
    const s = setup("decorum", 2);
    startDecorum(s, "decor-1", same);
    finishDecorum(s, "all-fulfilled");
    expect(winningPlayers(s.public)!.winners).toHaveLength(2);
    finishDecorum(s, "round-limit");
    expect(winningPlayers(s.public)).toBeNull();
    finishDecorum(s, "player-left");
    expect(winningPlayers(s.public)).toBeNull();
  });
  it("credits tied Splendor winners once each, excluding aborted games", () => {
    const s = setup("splendor", 2);
    startSplendorGame(s, "splendor-1", same);
    Object.assign(s.public.splendor!, {
      phase: "GAME_OVER",
      winners: ["p0", "p1", "p0"],
    });
    s.public.status = "finished";
    expect(winningPlayers(s.public)!.winners).toHaveLength(2);
    s.public.splendor!.aborted = true;
    expect(winningPlayers(s.public)).toBeNull();
  });
  it("uses the Mafia engine's final winner list including special roles", () => {
    const s = setup("mafia-de-cuba", 6);
    startMafia(s, "mafia-1", same);
    Object.assign(s.public.mafia!, {
      phase: "GAME_OVER",
      winners: ["p2", "p4"],
      winReason: "GODFATHER_ELIMINATED",
    });
    s.public.status = "finished";
    expect(winningPlayers(s.public)!.winners.map((p) => p.uid)).toEqual([
      "p2",
      "p4",
    ]);
    s.public.mafia!.winReason = "ABORTED";
    expect(winningPlayers(s.public)).toBeNull();
  });
  it("excludes practice, unfinished games, bots and departed proxy seats", () => {
    const s = avalon();
    const winners = winningPlayers(s.public)!.winners;
    s.public.players[winners[0].uid].isBot = true;
    s.public.players[winners[1].uid].isProxy = true;
    expect(winningPlayers(s.public)!.winners).toHaveLength(winners.length - 2);
    s.public.mode = "practice";
    expect(winningPlayers(s.public)).toBeNull();
    delete s.public.mode;
    s.public.status = "playing";
    expect(winningPlayers(s.public)).toBeNull();
  });
  it("keeps summaries constant-sized, sums across games and keeps newer nicknames", () => {
    const result = winningPlayers(avalon().public)!;
    const player = result.winners[0];
    const first = creditWin(null, result, player, 200)!;
    const second = creditWin(
      first,
      { ...result, matchId: "other-match", gameId: "splendor" },
      { ...player, nickname: "舊名字" },
      100,
    )!;
    expect(second.totalWins).toBe(2);
    expect(second.wins.avalon).toBe(1);
    expect(second.wins.splendor).toBe(1);
    expect(second.nickname).toBe(player.nickname);
    expect(publicStats(second)).not.toHaveProperty("processedMatches");
    expect(first.totalWins).toBe(1);
    expect(second).not.toHaveProperty("processedMatches");
  });
  it("queues once on the final action and preserves pending results across rematches", () => {
    const ended = avalon();
    const before = structuredClone(ended);
    before.public.status = "playing";
    queueSettlement(before, ended, 123);
    expect(Object.keys(ended.settlements!)).toEqual(["match-1"]);
    expect(ended.settlements!["match-1"].completedAt).toBe(123);
    const again = structuredClone(ended);
    queueSettlement(ended, again, 456);
    expect(again.settlements).toEqual(ended.settlements);
    again.public.status = "waiting";
    expect(queueSettlement(ended, again, 456)!.settlements).toEqual(
      ended.settlements,
    );
    expect(queueSettlement(before, null, 123)).toBeNull();
  });
  it("does not enqueue practice, aborted or ordinary game actions", () => {
    const before = avalon();
    before.public.status = "playing";
    const action = structuredClone(before);
    expect(queueSettlement(before, action, 1)!.settlements).toBeUndefined();
    const practice = avalon();
    practice.public.mode = "practice";
    expect(queueSettlement(before, practice, 1)!.settlements).toBeUndefined();
    const aborted = avalon();
    delete aborted.public.game!.winner;
    expect(queueSettlement(before, aborted, 1)!.settlements).toBeUndefined();
  });
});
