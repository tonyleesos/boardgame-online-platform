import { describe, expect, it } from "vitest";
import {
  startSplendorGame,
  applySplendorAction,
} from "../functions/src/splendor/engine";
import { chooseSplendorAction } from "../functions/src/splendor/bot";
import { advanceOneBot, botToken } from "../functions/src/bots";
import {
  GEM_COLORS,
  TOKEN_COLORS,
  CARD_BY_ID,
  DEMO_ORIENT_CARDS,
  calculateBonuses,
  calculatePrestige,
} from "../functions/src/shared/splendor";
import type { Expansion } from "../functions/src/shared/splendor";
import type { Session } from "../functions/src/shared/model";
function seeded(seed: number) {
  return <T>(items: T[]) => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
}
function fixture(count = 2, module: Expansion = "base", seed = 42) {
  const s: Session = {
    public: {
      code: "BOT234",
      gameId: "splendor",
      hostId: "p0",
      status: "waiting",
      createdAt: 0,
      players: Object.fromEntries(
        Array.from({ length: count }, (_, i) => [
          `p${i}`,
          {
            uid: `p${i}`,
            nickname: `商人${i}AI`,
            joinedAt: i,
            ready: true,
            isBot: i !== 0,
          },
        ]),
      ),
      splendorConfig: { module, competitorMode: false },
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startSplendorGame(s, "bot-game", seeded(seed));
  return s;
}
describe("Splendor AI complete games", () => {
  for (const module of [
    "base",
    "cities",
    "tradingPosts",
    "orient",
    "strongholds",
  ] as Expansion[])
    for (const casual of [false, true])
      it(`${module} / ${casual ? "casual" : "standard"} finishes 2–4 seats across seeded deals`, () => {
        for (const count of [2, 3, 4])
          for (const seed of [2, 43, 97]) {
            const s = fixture(count, module, seed),
              shuffle = seeded(seed + 1);
            s.public.botLevel = casual ? "casual" : "standard";
            // All policies see exactly the same observation shape available to a normal player.
            for (
              let turn = 0;
              turn < 1000 && s.public.status === "playing";
              turn++
            ) {
              const g = s.public.splendor!,
                uid = g.playerOrder[g.currentPlayerIndex],
                before = g.revision;
              if (s.public.players[uid].isBot) {
                expect(advanceOneBot(s, shuffle)).toBe(true);
              } else {
                const action = chooseSplendorAction(
                  uid,
                  g,
                  s.splendorPrivate![uid],
                  shuffle,
                  casual,
                );
                expect(action).not.toBeNull();
                Object.assign(s, applySplendorAction(s, uid, action!));
              }
              expect(s.public.splendor!.revision).toBe(before + 1);
              for (const c of TOKEN_COLORS)
                expect(
                  s.public.splendor!.bank[c] +
                    Object.values(s.public.splendor!.players).reduce(
                      (n, p) => n + p.tokens[c],
                      0,
                    ),
                ).toBe(
                  c === "gold" ? 5 : count === 2 ? 4 : count === 3 ? 5 : 7,
                );
            }
            expect(
              s.public.status,
              `${module} count=${count} seed=${seed}`,
            ).toBe("finished");
            expect(s.public.splendor!.winners?.length).toBeGreaterThan(0);
          }
      });
});
describe("AI observation, phases and legality", () => {
  it("does not act on human turn, and token changes for exactly one bot action", () => {
    const s = fixture(),
      g = s.public.splendor!;
    expect(advanceOneBot(s, seeded(1))).toBe(false);
    g.currentPlayerIndex = 1;
    const token = botToken(s.public);
    expect(advanceOneBot(s, seeded(1))).toBe(true);
    expect(botToken(s.public)).not.toBe(token);
    expect(g.revision).toBe(0);
    expect(s.public.splendor!.revision).toBe(1);
  });
  it("changing opponents blind cards and hidden deck order cannot affect a decision", () => {
    const s = fixture(),
      g = s.public.splendor!;
    g.currentPlayerIndex = 1;
    const first = chooseSplendorAction(
      "p1",
      g,
      s.splendorPrivate!.p1,
      seeded(9),
    );
    s.secret.splendor!.decks.base1.reverse();
    s.splendorPrivate!.p0.reserved = { hidden: "b3-1-1" };
    expect(
      chooseSplendorAction("p1", g, s.splendorPrivate!.p1, seeded(9)),
    ).toEqual(first);
  });
  it("buys its own hidden reservation without using public identity", () => {
    let s = fixture();
    s = applySplendorAction(s, "p0", {
      type: "splendorBlind",
      tier: 1,
      source: "base",
    });
    s.public.splendor!.currentPlayerIndex = 0;
    const p = s.public.splendor!.players.p0,
      slot = p.reservedCards[0].slot,
      id = s.splendorPrivate!.p0.reserved[slot];
    p.tokens = { ...CARD_BY_ID[id].cost, gold: 0 };
    for (const k of Object.keys(s.public.splendor!.market))
      s.public.splendor!.market[k] = s.public.splendor!.market[k].map(
        () => null,
      );
    const action = chooseSplendorAction(
      "p0",
      s.public.splendor!,
      s.splendorPrivate!.p0,
      seeded(1),
    );
    expect(action).toMatchObject({ type: "splendorBuy", slot });
  });
  it.each(["double", "copy", "return", "reserve", "noble"] as const)(
    "supplies legal Orient %s choices",
    (type) => {
      const s = fixture(2, "orient"),
        g = s.public.splendor!,
        p = g.players.p0,
        c = DEMO_ORIENT_CARDS.find((c) => c.orientEffect?.type === type)!;
      for (const key of Object.keys(g.market))
        g.market[key] = g.market[key].map(() => null);
      g.market[`orient${c.tier}`][0] = c.id;
      p.purchasedCardIds = ["b1-1-0"];
      p.bonuses = calculateBonuses(p);
      p.tokens = { ...c.cost, gold: 0 };
      const action = chooseSplendorAction(
        "p0",
        g,
        s.splendorPrivate!.p0,
        seeded(1),
      );
      expect(action?.type).toBe("splendorBuy");
      expect(() => applySplendorAction(s, "p0", action!)).not.toThrow();
    },
  );
  it("resolves exact excess, nobles and stronghold bonus purchase", () => {
    let s = fixture(2, "strongholds");
    const g = s.public.splendor!,
      p = g.players.p0;
    p.tokens = { white: 3, blue: 3, green: 3, red: 3, black: 0, gold: 1 };
    g.phase = "RETURN_EXCESS_TOKENS";
    let action = chooseSplendorAction(
      "p0",
      g,
      s.splendorPrivate!.p0,
      seeded(1),
    );
    expect(action?.type).toBe("splendorReturn");
    s = applySplendorAction(s, "p0", action!);
    expect(
      TOKEN_COLORS.reduce(
        (n, c) => n + s.public.splendor!.players.p0.tokens[c],
        0,
      ),
    ).toBe(10);
    s = fixture(2, "strongholds");
    const cardId = s.public.splendor!.market.base1[0]!;
    s.public.splendor!.strongholds[cardId] = { ownerUid: "p0", count: 3 };
    s.public.splendor!.players.p0.strongholdsRemaining = 0;
    s.public.splendor!.players.p0.tokens = {
      ...CARD_BY_ID[cardId].cost,
      gold: 0,
    };
    s.public.splendor!.phase = "STRONGHOLD_BONUS_PURCHASE";
    action = chooseSplendorAction(
      "p0",
      s.public.splendor!,
      s.splendorPrivate!.p0,
      seeded(1),
    );
    expect(action).toMatchObject({ type: "splendorBuy", cardId });
    s = applySplendorAction(s, "p0", action!);
    expect(s.public.splendor!.players.p0.strongholdsRemaining).toBe(3);
    expect(calculatePrestige(s.public.splendor!.players.p0)).toBe(
      CARD_BY_ID[cardId].prestige,
    );
    expect(
      GEM_COLORS.some((c) => s.public.splendor!.players.p0.bonuses[c] > 0),
    ).toBe(true);
  });
});
