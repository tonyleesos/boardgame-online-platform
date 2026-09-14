import { describe, it, expect } from "vitest";
import type { Session } from "../functions/src/shared/model";
import {
  startSplendorGame,
  applySplendorAction,
  createInitialTokenBank,
  validateSplendorConfig,
  evaluateTradingPosts,
} from "../functions/src/splendor/engine";
import {
  GEM_COLORS,
  TOKEN_COLORS,
  CARD_BY_ID,
  DEMO_CARDS,
  DEMO_ORIENT_CARDS,
  DEMO_NOBLES,
  DEMO_TRADING_POSTS,
  calculateBonuses,
  calculateEffectiveCost,
  calculatePurchasePayment,
  calculatePrestige,
  canTakeDoubleGem,
  mustReturnTokens,
  getEligibleNobles,
  determineSplendorWinners,
  getEligibleCities,
  normalizeSplendor,
  tokenTotal,
  emptyTokens,
  applyTradingPostModifiers,
} from "../functions/src/shared/splendor";
import type {
  Expansion,
  SplendorAction,
  OrientChoice,
} from "../functions/src/shared/splendor";
function seeded(seed = 42) {
  return <T>(values: T[]): T[] => {
    const a = [...values];
    for (let i = a.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
}
export function setup(count = 2, module: Expansion = "base") {
  const s: Session = {
    public: {
      code: "ABCDEF",
      gameId: "splendor",
      hostId: "p0",
      status: "waiting",
      createdAt: 0,
      players: Object.fromEntries(
        Array.from({ length: count }, (_, i) => [
          `p${i}`,
          { uid: `p${i}`, nickname: `玩家${i}`, joinedAt: i, ready: true },
        ]),
      ),
      splendorConfig: { module, competitorMode: false },
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startSplendorGame(s, "game", seeded());
  return s;
}
function act(
  s: Session,
  action: SplendorAction,
  uid = s.public.splendor!.playerOrder[s.public.splendor!.currentPlayerIndex],
) {
  return applySplendorAction(s, uid, action);
}
function marketCard(s: Session, id: string) {
  const c = CARD_BY_ID[id];
  s.public.splendor!.market[`${c.source}${c.tier}`][0] = id;
  return c;
}
function giveBonuses(
  s: Session,
  uid: string,
  counts: Partial<Record<(typeof GEM_COLORS)[number], number>>,
) {
  const p = s.public.splendor!.players[uid];
  p.purchasedCardIds = [];
  for (const color of GEM_COLORS)
    p.purchasedCardIds.push(
      ...DEMO_CARDS.filter((c) => c.bonusColor === color && c.prestige === 0)
        .slice(0, counts[color] ?? 0)
        .map((c) => c.id),
    );
  p.bonuses = calculateBonuses(p);
}
describe("Splendor setup and validation", () => {
  it.each([2, 3, 4])(
    "%i player setup, private decks, unique cards, deterministic seed",
    (count) => {
      const s = setup(count),
        g = s.public.splendor!;
      expect(g.bank).toEqual(createInitialTokenBank(count));
      expect(g.bank.white).toBe(count === 2 ? 4 : count === 3 ? 5 : 7);
      expect(g.bank.gold).toBe(5);
      expect(g.nobles).toHaveLength(count + 1);
      expect(Object.values(g.market).every((r) => r.length === 4)).toBe(true);
      expect(setup(count)).toEqual(s);
      expect(JSON.stringify(g)).not.toContain("decks");
      expect(
        new Set([
          ...Object.values(g.market).flat(),
          ...Object.values(s.secret.splendor!.decks).flat(),
        ]).size,
      ).toBe(DEMO_CARDS.length);
    },
  );
  it("rejects invalid player counts and unsupported combinations", () => {
    expect(() => setup(1)).toThrow();
    expect(() => setup(5)).toThrow();
    expect(() =>
      validateSplendorConfig({
        module: "base",
        competitorMode: false,
        orient: true,
      } as never),
    ).toThrow();
    expect(() =>
      validateSplendorConfig({
        module: "toString",
        competitorMode: false,
      } as never),
    ).toThrow();
  });
  it("requires ready real members", () => {
    const s = setup();
    s.public.status = "waiting";
    s.public.players.p0.ready = false;
    expect(() => startSplendorGame(s, "g", seeded())).toThrow();
  });
  it("normalizes RTDB omitted empty arrays and null market slots", () => {
    const g = setup().public.splendor!;
    delete (g as Partial<typeof g>).nobles;
    g.market.base1 = [null, null];
    delete (g.players.p0 as Partial<typeof g.players.p0>).purchasedCardIds;
    normalizeSplendor(g);
    expect(g.nobles).toEqual([]);
    expect(g.market.base1).toEqual([null, null, null, null]);
    expect(g.players.p0.purchasedCardIds).toEqual([]);
  });
});
describe("Gem actions and mandatory returns", () => {
  it("takes distinct gems, conserves supply and advances exactly once", () => {
    const s = act(setup(), {
        type: "splendorTake",
        colors: ["white", "green", "red"],
      }),
      g = s.public.splendor!;
    expect(g.players.p0.tokens.white).toBe(1);
    expect(g.bank.white).toBe(3);
    expect(g.currentPlayerIndex).toBe(1);
    expect(g.revision).toBe(1);
  });
  it.each([
    [],
    ["red", "red"],
    ["gold"],
    ["white", "blue", "green", "red"],
    ["toString"],
  ])("rejects invalid gem selection %j", (colors) => {
    const s = setup(),
      before = structuredClone(s);
    expect(() => act(s, { type: "splendorTake", colors } as never)).toThrow();
    expect(s).toEqual(before);
  });
  it("allows one available distinct gem", () => {
    expect(
      act(setup(), { type: "splendorTake", colors: ["red"] }).public.splendor!
        .players.p0.tokens.red,
    ).toBe(1);
  });
  it("takes double only with four before taking", () => {
    const s = setup();
    expect(canTakeDoubleGem(s.public.splendor!, "blue")).toBe(true);
    expect(
      act(s, { type: "splendorDouble", color: "blue" }).public.splendor!.bank
        .blue,
    ).toBe(2);
    s.public.splendor!.bank.blue = 3;
    expect(() => act(s, { type: "splendorDouble", color: "blue" })).toThrow();
    expect(() =>
      act(s, { type: "splendorDouble", color: "gold" } as never),
    ).toThrow();
  });
  it("rejects unavailable gems and wrong actor", () => {
    const s = setup();
    s.public.splendor!.bank.red = 0;
    expect(() => act(s, { type: "splendorTake", colors: ["red"] })).toThrow();
    expect(() =>
      act(s, { type: "splendorTake", colors: ["blue"] }, "p1"),
    ).toThrow("回合");
    expect(() =>
      act(s, { type: "splendorTake", colors: ["blue"] }, "outsider"),
    ).toThrow();
  });
  it("requires exact owned nonnegative integer returns including gold", () => {
    let s = setup();
    s.public.splendor!.players.p0.tokens = {
      white: 2,
      blue: 2,
      green: 2,
      red: 2,
      black: 1,
      gold: 1,
    };
    expect(mustReturnTokens(s.public.splendor!.players.p0)).toBe(0);
    s = act(s, { type: "splendorDouble", color: "red" });
    expect(s.public.splendor!.phase).toBe("RETURN_EXCESS_TOKENS");
    for (const tokens of [
      { red: 1 },
      { gold: 2 },
      { red: -2 },
      { red: 1.5, gold: 0.5 },
      { red: 2, toString: 0 },
    ])
      expect(() =>
        act(s, { type: "splendorReturn", tokens } as never),
      ).toThrow();
    expect(() => act(s, { type: "splendorTake", colors: ["blue"] })).toThrow();
    const before = s.public.splendor!.bank.gold;
    s = act(s, { type: "splendorReturn", tokens: { red: 1, gold: 1 } });
    expect(s.public.splendor!.bank.gold).toBe(before + 1);
    expect(tokenTotal(s.public.splendor!.players.p0.tokens)).toBe(10);
    expect(s.public.splendor!.currentPlayerIndex).toBe(1);
  });
});
describe("Reservation and payment", () => {
  it("reserves visible, refills same slot, grants gold", () => {
    let s = setup();
    const id = s.public.splendor!.market.base1[0]!;
    s = act(s, { type: "splendorReserve", cardId: id });
    const g = s.public.splendor!;
    expect(g.players.p0.reservedCards[0].cardId).toBe(id);
    expect(g.market.base1[0]).not.toBe(id);
    expect(g.deckCounts.base1).toBe(
      DEMO_CARDS.filter((c) => c.tier === 1).length - 5,
    );
    expect(g.players.p0.tokens.gold).toBe(1);
  });
  it("blind card identity stays out of all public state and logs", () => {
    let s = setup();
    const id = s.secret.splendor!.decks.base2[0];
    s = act(s, { type: "splendorBlind", tier: 2, source: "base" });
    expect(JSON.stringify(s.public)).not.toContain(id);
    expect(Object.values(s.splendorPrivate!.p0.reserved)).toContain(id);
    expect(Object.values(s.splendorPrivate!.p1.reserved)).not.toContain(id);
  });
  it("reserve with empty gold, max three and exhausted decks", () => {
    let s = setup();
    s.public.splendor!.bank.gold = 0;
    for (let i = 0; i < 3; i++) {
      s.public.splendor!.currentPlayerIndex = 0;
      s = act(s, { type: "splendorBlind", tier: 1, source: "base" });
    }
    expect(s.public.splendor!.players.p0.tokens.gold).toBe(0);
    s.public.splendor!.currentPlayerIndex = 0;
    expect(() =>
      act(s, { type: "splendorBlind", tier: 1, source: "base" }),
    ).toThrow("3");
    s = setup();
    s.secret.splendor!.decks.base1 = [];
    expect(() =>
      act(s, { type: "splendorBlind", tier: 1, source: "base" }),
    ).toThrow();
    const id = s.public.splendor!.market.base1[0]!;
    s = act(s, { type: "splendorReserve", cardId: id });
    expect(s.public.splendor!.market.base1[0]).toBeNull();
  });
  it("derives discounts from cards and pays missing gems using gold", () => {
    const s = setup();
    giveBonuses(s, "p0", { white: 2, blue: 2, green: 2, red: 2, black: 2 });
    const p = s.public.splendor!.players.p0;
    p.bonuses.red = 999;
    const c = CARD_BY_ID["b1-0-4"];
    expect(calculateEffectiveCost(c, p).red).toBe(2);
    p.tokens.red = 1;
    p.tokens.gold = 1;
    const payment = calculatePurchasePayment(c, p);
    expect(payment.affordable).toBe(true);
    expect(payment.goldPayment).toBe(1);
    expect(payment.normalPayment.red).toBe(1);
    expect(calculateEffectiveCost(CARD_BY_ID["b1-0-0"], p).white).toBe(0);
  });
  it("pays bank and gains authoritative score/bonus", () => {
    let s = setup();
    const c = marketCard(s, "b1-0-4");
    s.public.splendor!.players.p0.tokens.red = 4;
    s = act(s, { type: "splendorBuy", cardId: c.id });
    const p = s.public.splendor!.players.p0;
    expect(p.tokens.red).toBe(0);
    expect(s.public.splendor!.bank.red).toBe(8);
    expect(p.bonuses.white).toBe(1);
    expect(p.prestige).toBe(1);
  });
  it("purchases a private reserve by slot and removes only that slot", () => {
    let s = act(setup(), { type: "splendorBlind", tier: 1, source: "base" });
    s.public.splendor!.currentPlayerIndex = 0;
    const slot = s.public.splendor!.players.p0.reservedCards[0].slot,
      id = s.splendorPrivate!.p0.reserved[slot],
      c = CARD_BY_ID[id];
    s.public.splendor!.players.p0.tokens = { ...c.cost, gold: 0 };
    s = act(s, { type: "splendorBuy", slot });
    expect(s.public.splendor!.players.p0.purchasedCardIds).toContain(id);
    expect(s.public.splendor!.players.p0.reservedCards).toHaveLength(0);
    expect(s.splendorPrivate!.p0.reserved[slot]).toBeUndefined();
  });
  it("rejects unaffordable, nonexistent, forged payment and reserve ownership", () => {
    const s = setup(),
      id = s.public.splendor!.market.base3[0]!;
    expect(() =>
      act(s, { type: "splendorBuy", cardId: id, payment: 0 } as never),
    ).toThrow();
    expect(() => act(s, { type: "splendorBuy", cardId: "bogus" })).toThrow();
    expect(() => act(s, { type: "splendorBuy", slot: "other" })).toThrow();
    expect(() =>
      act(s, { type: "splendorBuy", cardId: id, slot: "other" }),
    ).toThrow();
  });
});
describe("Nobles and final round", () => {
  it("tokens alone never qualify; one noble awards and never refills", () => {
    let s = setup();
    const g = s.public.splendor!;
    g.nobles = [DEMO_NOBLES[0]];
    g.players.p0.tokens = {
      white: 7,
      blue: 7,
      green: 7,
      red: 7,
      black: 7,
      gold: 5,
    };
    expect(getEligibleNobles(g.players.p0, g)).toHaveLength(0);
    g.players.p0.tokens = emptyTokens();
    giveBonuses(s, "p0", { white: 4, blue: 4, green: 4, red: 4, black: 4 });
    s = act(s, { type: "splendorTake", colors: ["red"] });
    expect(s.public.splendor!.players.p0.nobles).toHaveLength(1);
    expect(s.public.splendor!.nobles).toHaveLength(0);
  });
  it("multiple nobles require exactly one valid choice", () => {
    let s = setup();
    giveBonuses(s, "p0", { white: 4, blue: 4, green: 4, red: 4, black: 4 });
    s = act(s, { type: "splendorTake", colors: ["red"] });
    expect(s.public.splendor!.phase).toBe("CHOOSE_NOBLE");
    expect(() =>
      act(s, { type: "splendorNoble", nobleId: "invalid" }),
    ).toThrow();
    s = act(s, {
      type: "splendorNoble",
      nobleId: s.public.splendor!.nobles[0].id,
    });
    expect(s.public.splendor!.players.p0.nobles).toHaveLength(1);
    expect(s.public.splendor!.currentPlayerIndex).toBe(1);
  });
  it.each([0, 1, 2, 3])(
    "final round triggered from seat %i preserves equal turns",
    (seat) => {
      let s = setup(4);
      const g = s.public.splendor!;
      g.currentPlayerIndex = seat;
      g.players[`p${seat}`].purchasedCardIds = DEMO_CARDS.filter(
        (c) => c.prestige === 5,
      )
        .slice(0, 3)
        .map((c) => c.id);
      s = act(s, { type: "splendorTake", colors: ["white"] });
      expect(s.public.splendor!.finalRoundNumber).toBe(1);
      for (let i = seat + 1; i < 4; i++)
        s = act(s, { type: "splendorTake", colors: ["white"] });
      expect(s.public.status).toBe("finished");
      expect(s.public.splendor!.winners).toEqual([`p${seat}`]);
      expect(() =>
        act(s, { type: "splendorTake", colors: ["white"] }),
      ).toThrow();
    },
  );
  it("fewer purchased cards breaks ties; exact ties are shared", () => {
    const g = setup().public.splendor!;
    const id = DEMO_CARDS.find((c) => c.prestige === 3)!.id;
    g.players.p0.purchasedCardIds = [id];
    g.players.p1.nobles = [DEMO_NOBLES[0]];
    expect(determineSplendorWinners(g)).toEqual(["p1"]);
    g.players.p0.purchasedCardIds = [];
    g.players.p0.nobles = [DEMO_NOBLES[1]];
    expect(determineSplendorWinners(g)).toEqual(["p0", "p1"]);
  });
});
describe("Expansions", () => {
  it("cities replace nobles and only qualified players can win", () => {
    let s = setup(2, "cities");
    const g = s.public.splendor!;
    expect(g.nobles).toEqual([]);
    expect(g.cities).toHaveLength(3);
    g.players.p0.purchasedCardIds = DEMO_CARDS.filter(
      (c) => c.prestige === 5,
    ).map((c) => c.id);
    expect(getEligibleCities(g.players.p0, g)).toHaveLength(0);
    s = act(s, { type: "splendorTake", colors: ["red"] });
    expect(s.public.splendor!.endTriggeredBy).toBeUndefined();
    s.public.splendor!.currentPlayerIndex = 0;
    giveBonuses(s, "p0", { white: 4, blue: 4, green: 4, red: 4, black: 4 });
    s.public.splendor!.players.p0.nobles = DEMO_NOBLES.slice(0, 5);
    s = act(s, { type: "splendorTake", colors: ["blue"] });
    expect(s.public.splendor!.endTriggeredBy).toBe("p0");
    s.public.splendor!.players.p1.purchasedCardIds = DEMO_CARDS.filter(
      (c) => c.prestige === 5,
    ).map((c) => c.id);
    s = act(s, { type: "splendorTake", colors: ["green"] });
    expect(s.public.splendor!.winners).toEqual(["p0"]);
  });
  it("posts unlock once with persistent gold, token and score modifiers", () => {
    const s = setup(2, "tradingPosts");
    giveBonuses(s, "p0", { white: 4, blue: 4, green: 4, red: 4, black: 4 });
    const p = s.public.splendor!.players.p0;
    evaluateTradingPosts(p);
    evaluateTradingPosts(p);
    expect(p.tradingPosts).toHaveLength(5);
    expect(new Set(p.tradingPosts).size).toBe(5);
    expect(applyTradingPostModifiers(p)).toEqual({
      maxDifferent: 3,
      goldValue: 2,
      tokenLimit: 12,
      prestige: 6,
    });
    p.tokens.gold = 2;
    const card = {
      ...CARD_BY_ID["b1-0-0"],
      cost: { white: 5, blue: 5, green: 5, red: 5, black: 4 },
    };
    expect(calculatePurchasePayment(card, p).goldPayment).toBe(2);
    expect(calculatePrestige(p)).toBe(6);
    expect(DEMO_TRADING_POSTS).toHaveLength(5);
  });
  it("all posts keep the three-color limit; the token limit modifier still applies", () => {
    let s = setup(2, "tradingPosts");
    s.public.splendor!.players.p0.tradingPosts = ["post-gem", "post-limit"];
    s.public.splendor!.players.p0.tokens.gold = 8;
    expect(() => act(s, {
      type: "splendorTake",
      colors: ["white", "blue", "green", "red"],
    })).toThrow();
    s = act(s, { type: "splendorTake", colors: ["white", "blue", "green"] });
    expect(s.public.splendor!.currentPlayerIndex).toBe(1);
    expect(tokenTotal(s.public.splendor!.players.p0.tokens)).toBe(11);
  });
  it.each(["double", "copy", "return", "reserve", "noble"] as const)(
    "Orient %s effect validates and resolves atomically",
    (type) => {
      let s = setup(2, "orient");
      expect(s.public.splendor!.market.orient1).toHaveLength(2);
      expect(s.public.splendor!.market.orient2).toHaveLength(2);
      const card = DEMO_ORIENT_CARDS.find(
        (c) => c.orientEffect?.type === type,
      )!;
      marketCard(s, card.id);
      const p = s.public.splendor!.players.p0;
      p.tokens = { ...card.cost, gold: 0 };
      p.purchasedCardIds = ["b1-1-0"];
      const choice: OrientChoice =
        type === "copy"
          ? { color: "blue" }
          : type === "return"
            ? { returnCardId: "b1-1-0" }
            : type === "reserve"
              ? { reserveCardId: s.public.splendor!.market.base1[0]! }
              : type === "noble"
                ? { nobleId: s.public.splendor!.nobles[0].id }
                : {};
      if (type === "copy" || type === "return") {
        const before = structuredClone(s);
        expect(() =>
          act(s, { type: "splendorBuy", cardId: card.id, choice: {} }),
        ).toThrow();
        expect(s).toEqual(before);
      }
      const count = s.public.splendor!.deckCounts[`orient${card.tier}`];
      s = act(s, { type: "splendorBuy", cardId: card.id, choice });
      const next = s.public.splendor!.players.p0;
      expect(next.purchasedCardIds).toContain(card.id);
      expect(s.public.splendor!.deckCounts[`orient${card.tier}`]).toBe(
        count - 1,
      );
      if (type === "double") expect(next.bonuses[card.bonusColor]).toBe(2);
      if (type === "copy") expect(next.bonuses.blue).toBe(2);
      if (type === "return")
        expect(next.purchasedCardIds).not.toContain("b1-1-0");
      if (type === "reserve") {
        expect(next.reservedCards).toHaveLength(1);
        expect(next.tokens.gold).toBe(0);
      }
      if (type === "noble")
        expect(next.pledgedNobleIds).toEqual([choice.nobleId]);
    },
  );
  it("pledged nobles cannot visit opponents; invitation alone does not score", () => {
    const s = setup(2, "orient"),
      g = s.public.splendor!;
    giveBonuses(s, "p1", { white: 4, blue: 4, green: 4, red: 4, black: 4 });
    const id = g.nobles[0].id;
    g.players.p0.pledgedNobleIds = [id];
    expect(getEligibleNobles(g.players.p1, g).map((n) => n.id)).not.toContain(
      id,
    );
    expect(calculatePrestige(g.players.p0)).toBe(0);
  });
  it("stronghold placement/removal, protection and three-marker bonus purchase", () => {
    let s = setup(2, "strongholds");
    const g = s.public.splendor!,
      id = g.market.base1[0]!;
    expect(g.players.p0.strongholdsRemaining).toBe(3);
    g.strongholds[id] = { ownerUid: "p0", count: 2 };
    g.players.p0.strongholdsRemaining = 1;
    g.phase = "RESOLVE_EXPANSION";
    s = act(s, { type: "splendorStronghold", cardId: id });
    expect(s.public.splendor!.phase).toBe("STRONGHOLD_BONUS_PURCHASE");
    s.public.splendor!.players.p0.tokens = { ...CARD_BY_ID[id].cost, gold: 0 };
    s = act(s, { type: "splendorBuy", cardId: id });
    expect(s.public.splendor!.players.p0.strongholdsRemaining).toBe(3);
    expect(s.public.splendor!.strongholds[id]).toBeUndefined();
    expect(s.public.splendor!.currentPlayerIndex).toBe(1);
    s = setup(2, "strongholds");
    const protectedId = s.public.splendor!.market.base1[0]!;
    s.public.splendor!.strongholds[protectedId] = { ownerUid: "p1", count: 1 };
    s.public.splendor!.players.p1.strongholdsRemaining = 2;
    expect(() =>
      act(s, { type: "splendorReserve", cardId: protectedId }),
    ).toThrow("保護");
    s.public.splendor!.players.p0.tokens = {
      ...CARD_BY_ID[protectedId].cost,
      gold: 0,
    };
    expect(() => act(s, { type: "splendorBuy", cardId: protectedId })).toThrow(
      "保護",
    );
    s.public.splendor!.phase = "RESOLVE_EXPANSION";
    expect(() =>
      act(s, { type: "splendorStronghold", cardId: protectedId }),
    ).toThrow();
    s = act(s, {
      type: "splendorStronghold",
      cardId: protectedId,
      remove: true,
    });
    expect(s.public.splendor!.players.p1.strongholdsRemaining).toBe(3);
  });
  it("purchase enters stronghold phase; skip cannot skip a primary action", () => {
    let s = setup(2, "strongholds");
    const id = s.public.splendor!.market.base1[0]!;
    expect(() => act(s, { type: "splendorSkip" })).toThrow();
    s.public.splendor!.players.p0.tokens = { ...CARD_BY_ID[id].cost, gold: 0 };
    s = act(s, { type: "splendorBuy", cardId: id });
    expect(s.public.splendor!.phase).toBe("RESOLVE_EXPANSION");
    s = act(s, { type: "splendorStronghold" });
    expect(s.public.splendor!.currentPlayerIndex).toBe(1);
  });
});
describe("complete games with conserved resources", () => {
  it.each([
    "base",
    "cities",
    "tradingPosts",
    "orient",
    "strongholds",
  ] as Expansion[])("finishes %s without database edits", (module) => {
    let s = setup(4, module);
    for (let step = 0; step < 2000 && s.public.status === "playing"; step++) {
      const g = s.public.splendor!,
        p = g.players[g.playerOrder[g.currentPlayerIndex]];
      let action: SplendorAction;
      if (g.phase === "RETURN_EXCESS_TOKENS") {
        const tokens = emptyTokens();
        let excess = mustReturnTokens(p);
        for (const c of [...TOKEN_COLORS].sort(
          (a, b) => p.tokens[b] - p.tokens[a],
        )) {
          tokens[c] = Math.min(excess, p.tokens[c]);
          excess -= tokens[c];
        }
        action = { type: "splendorReturn", tokens };
      } else if (g.phase === "CHOOSE_NOBLE")
        action = {
          type: "splendorNoble",
          nobleId: getEligibleNobles(p, g)[0].id,
        };
      else if (g.phase === "RESOLVE_EXPANSION")
        action = { type: "splendorStronghold" };
      else if (g.phase === "STRONGHOLD_BONUS_PURCHASE")
        action = { type: "splendorSkip" };
      else {
        const cards = Object.values(g.market)
          .flat()
          .filter((id): id is string => !!id)
          .map((id) => CARD_BY_ID[id])
          .filter((c) => !c.orientEffect || c.orientEffect.type === "double");
        const affordable = cards
          .filter((c) => calculatePurchasePayment(c, p).affordable)
          .sort(
            (a, b) =>
              b.prestige * 2 +
              (6 - p.bonuses[b.bonusColor]) -
              (a.prestige * 2 + (6 - p.bonuses[a.bonusColor])),
          );
        if (affordable.length)
          action = { type: "splendorBuy", cardId: affordable[0].id };
        else {
          const target = cards.sort((a, b) => {
            const rank = (c: typeof a) => {
              const pay = calculatePurchasePayment(c, p);
              return (
                GEM_COLORS.reduce(
                  (n, k) =>
                    n + Math.max(0, pay.requiredAfterBonuses[k] - p.tokens[k]),
                  0,
                ) -
                c.prestige * 0.4
              );
            };
            return rank(a) - rank(b);
          })[0];
          const pay = calculatePurchasePayment(target, p);
          const colors = [...GEM_COLORS]
            .filter((c) => g.bank[c] > 0)
            .sort(
              (a, b) =>
                pay.requiredAfterBonuses[b] -
                p.tokens[b] -
                (pay.requiredAfterBonuses[a] - p.tokens[a]),
            );
          if (colors.length)
            action = {
              type: "splendorTake",
              colors: colors.slice(
                0,
                applyTradingPostModifiers(p).maxDifferent,
              ),
            };
          else if (p.reservedCards.length < 3)
            action = { type: "splendorReserve", cardId: target.id };
          else throw new Error("simulation stalled");
        }
      }
      s = act(s, action);
      const next = s.public.splendor!;
      for (const c of TOKEN_COLORS)
        expect(
          next.bank[c] +
            Object.values(next.players).reduce((n, p) => n + p.tokens[c], 0),
        ).toBe(c === "gold" ? 5 : 7);
      for (const player of Object.values(next.players)) {
        expect(player.tokens.gold).toBeGreaterThanOrEqual(0);
        expect(player.prestige).toBe(calculatePrestige(player));
      }
    }
    expect(s.public.status).toBe("finished");
    expect(s.public.splendor!.winners?.length).toBeGreaterThan(0);
  });
});
