import { describe, expect, it } from "vitest";
import { botNickname } from "../functions/src/bot-names";
import { leaveSeat } from "../functions/src/membership";
import { startGame } from "../functions/src/engine";
import type { Player, Session } from "../functions/src/shared/model";

describe("AI nicknames", () => {
  it("uses a random name ending in AI, stable on retries and distinct per occupied seat", () => {
    const players: Record<string, Player> = {};
    const first = botNickname(players, "room-seed");
    players.human = { uid: "human", nickname: first, joinedAt: 0, ready: true };
    for (let i = 0; i < 10; i++) {
      const nickname = botNickname(players, "room-seed");
      expect(nickname).toBe(botNickname(players, "room-seed"));
      expect(nickname).toMatch(/^[\u4e00-\u9fff]+AI$/);
      expect(Object.values(players).some((p) => p.nickname === nickname)).toBe(false);
      players[`bot${i}`] = { uid: `bot${i}`, nickname, joinedAt: i, ready: true, isBot: true };
    }
    expect(new Set(Array.from({ length: 20 }, (_, i) => botNickname({}, `seed-${i}`))).size).toBeGreaterThan(1);
  });
  it("renames an AI takeover while preserving its seat and role", () => {
    const s: Session = { public: { code: "BOT234", gameId: "avalon", status: "waiting", hostId: "p0", createdAt: 0,
      players: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`p${i}`, { uid: `p${i}`, nickname: `Player${i}`, joinedAt: i, ready: true }])) }, private: {}, secret: { teamVotes: {}, missionVotes: {} } };
    startGame(s, "bot-test", (a) => a);
    const role = structuredClone(s.private.p0);
    leaveSeat(s, "p0");
    expect(s.public.players.p0).toMatchObject({ uid: "p0", isBot: true, isProxy: true });
    expect(s.public.players.p0.nickname).toMatch(/^[\u4e00-\u9fff]+AI$/);
    expect(s.private.p0).toEqual(role);
    expect(s.public.hostId).toBe("p1");
  });
});
