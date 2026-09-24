import { describe, it, expect } from "vitest";
import type { Session } from "../functions/src/shared/model";
import { startMine, applyMineAction } from "../functions/src/saboteur/engine";
import { chooseMineAction } from "../functions/src/saboteur/bot";
import {
  calculateRoundGoldAwards,
  resolveColoredTeams,
  theftOrder,
  winnerShare,
} from "../functions/src/saboteur/scoring";
import {
  MINE_CARDS,
  MINE_CARD_BY_ID,
  ROLE_DECK,
  mineActor,
  type MineAction,
  type DwarfRole,
  type ActionKind,
} from "../functions/src/shared/saboteur";
const identity = <T>(a: readonly T[]) => [...a];
function rng(seed: number) {
  return <T>(a: readonly T[]) => {
    const v = [...a];
    for (let i = v.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [v[i], v[j]] = [v[j], v[i]];
    }
    return v;
  };
}
function setup(count = 4, seed?: number) {
  const s: Session = {
    public: {
      code: "MINE22",
      gameId: "saboteur-2",
      hostId: "p0",
      status: "waiting",
      createdAt: 0,
      players: Object.fromEntries(
        Array.from({ length: count }, (_, i) => [
          `p${i}`,
          { uid: `p${i}`, nickname: `矮人${i}`, ready: true, joinedAt: i },
        ]),
      ),
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startMine(s, "test", seed === undefined ? identity : rng(seed));
  return s;
}
const act = (s: Session, a: MineAction, uid = mineActor(s.public.saboteur!)) =>
  applyMineAction(s, uid, a, identity);
function give(s: Session, kind: ActionKind) {
  const c = MINE_CARDS.find((c) => c.kind === "action" && c.action === kind)!;
  s.saboteurPrivate!.p0.hand = [c.id, "path-0", "path-1"];
  return c.id;
}
describe("Saboteur setup and actions", () => {
  it("starts after Firebase omits an empty secret branch", () => {
    const s = setup(2);
    s.public.status = "waiting";
    delete (s as Partial<Session>).secret;
    startMine(s, "restart", identity);
    expect(s.secret.saboteur!.deck.length).toBe(99);
  });
  it.each([2, 5, 12])(
    "deals six cards to %i seats, hides ten, keeps 15 roles",
    (n) => {
      const s = setup(n),
        g = s.public.saboteur!;
      expect(
        Object.values(s.saboteurPrivate!).every((p) => p.hand.length === 6),
      ).toBe(true);
      expect(s.secret.saboteur!.removed).toHaveLength(10);
      expect(s.secret.saboteur!.roles).toHaveLength(15 - n);
      expect(g.drawCount).toBe(MINE_CARDS.length - 10 - n * 6);
      expect(Object.keys(g.board)).toHaveLength(4);
      expect(JSON.stringify(g)).not.toContain("BLUE_DIGGER");
      expect(ROLE_DECK).toHaveLength(15);
    },
  );
  it.each(["BREAK", "TRAPPED", "THEFT"] as ActionKind[])(
    "%s persists and cannot be duplicated",
    (kind) => {
      let s = setup();
      const id = give(s, kind),
        effect = kind === "BREAK" ? "PICKAXE" : (kind as "TRAPPED" | "THEFT"),
        target = kind === "THEFT" ? "p0" : "p1";
      s = act(s, { type: "mineAction", cardId: id, target });
      expect(s.public.saboteur!.players[target].effects[effect]).toBeTruthy();
      s.public.saboteur!.current = 0;
      give(s, kind);
      expect(() =>
        act(s, { type: "mineAction", cardId: id, target }),
      ).toThrow();
    },
  );
  it("broken tools and traps block paths, and cleanup removes exactly one effect", () => {
    let s = setup();
    s.public.saboteur!.players.p0.effects = {
      TRAPPED: { cardId: "action-1", sequence: 0 },
      PICKAXE: { cardId: "action-2", sequence: 1 },
    };
    s.saboteurPrivate!.p0.hand = ["path-0", "path-1", "path-2"];
    expect(() =>
      act(s, { type: "minePath", cardId: "path-0", x: 1, y: 0, rotation: 0 }),
    ).toThrow();
    s = act(s, {
      type: "mineClean",
      cards: ["path-0", "path-1"],
      effect: "TRAPPED",
    });
    expect(s.public.saboteur!.players.p0.effects.TRAPPED).toBeUndefined();
    expect(s.public.saboteur!.players.p0.effects.PICKAXE).toBeTruthy();
    expect(s.saboteurPrivate!.p0.hand).toHaveLength(2);
    expect(JSON.stringify(s.public.saboteur!.activities)).not.toContain(
      "path-0",
    );
  });
  it.each([
    ["REPAIR", "PICKAXE"],
    ["FREEDOM", "TRAPPED"],
    ["HANDS_OFF", "THEFT"],
  ] as const)("%s removes a matching effect", (kind, effect) => {
    let s = setup();
    const id = give(s, kind);
    expect(() =>
      act(s, { type: "mineAction", cardId: id, target: "p1", tool: "PICKAXE" }),
    ).toThrow();
    s.public.saboteur!.players.p1.effects[effect] = {
      cardId: "action-1",
      sequence: 0,
    };
    s = act(s, {
      type: "mineAction",
      cardId: id,
      target: "p1",
      tool: "PICKAXE",
    });
    expect(s.public.saboteur!.players.p1.effects[effect]).toBeUndefined();
    expect(s.secret.saboteur!.discard).toHaveLength(2);
  });
  it("dual repair removes only one, and rejects a mismatching tool", () => {
    let s = setup();
    const card = MINE_CARDS.find(
      (c) => c.kind === "action" && c.tools?.length === 2,
    )!;
    s.saboteurPrivate!.p0.hand = [card.id];
    s.public.saboteur!.players.p0.effects = {
      PICKAXE: { cardId: "action-0", sequence: 0 },
      LANTERN: { cardId: "action-5", sequence: 0 },
    };
    expect(() =>
      act(s, {
        type: "mineAction",
        cardId: card.id,
        target: "p0",
        tool: "CART",
      }),
    ).toThrow();
    s = act(s, {
      type: "mineAction",
      cardId: card.id,
      target: "p0",
      tool: "PICKAXE",
    });
    expect(Object.keys(s.public.saboteur!.players.p0.effects)).toEqual([
      "LANTERN",
    ]);
  });
  it.each(["MAP", "INSPECTION"] as const)(
    "%s private information requires acknowledgement and survives reload",
    (kind) => {
      let s = setup();
      const id = give(s, kind);
      s.saboteurPrivate!.p1.role = "GEOLOGIST";
      s = act(s, {
        type: "mineAction",
        cardId: id,
        cell: "8_-2",
        target: "p1",
      });
      expect(s.public.saboteur!.phase).toBe("PRIVATE_RESULT");
      expect(s.saboteurPrivate!.p0.notice).toBeTruthy();
      expect(JSON.stringify(s.public.saboteur)).not.toContain("GEOLOGIST");
      expect(s.saboteurPrivate!.p1.notice).toBeUndefined();
      expect(s.secret.saboteur!.discard).not.toContain(id);
      expect(() => act(s, { type: "minePass", cards: ["path-0"] })).toThrow();
      s = act(JSON.parse(JSON.stringify(s)), { type: "mineAcknowledge" });
      expect(s.secret.saboteur!.discard).toContain(id);
      expect(s.public.saboteur!.current).toBe(1);
    },
  );
  it("changes hats immediately and retains old inspection observations", () => {
    let s = setup();
    const id = give(s, "CHANGE_HATS"),
      old = s.saboteurPrivate!.p0.role,
      next = s.secret.saboteur!.roles[0];
    s.saboteurPrivate!.p1.inspections = [{ uid: "p0", role: old, revision: 0 }];
    s = act(s, { type: "mineAction", cardId: id, target: "p0" });
    expect(s.saboteurPrivate!.p0.role).toBe(next);
    expect(s.secret.saboteur!.roles.at(-1)).toBe(old);
    expect(s.saboteurPrivate!.p1.inspections[0].role).toBe(old);
  });
  it("swaps complete hands AFTER playing the card and draws only for the target", () => {
    let s = setup();
    const id = give(s, "SWAP_HANDS"),
      targetHand = [...s.saboteurPrivate!.p1.hand],
      next = s.secret.saboteur!.deck[0];
    s = act(s, { type: "mineAction", cardId: id, target: "p1" });
    expect(s.saboteurPrivate!.p0.hand).toEqual(targetHand);
    expect(s.saboteurPrivate!.p1.hand).toEqual(["path-0", "path-1", next]);
    expect(JSON.stringify(s.public.saboteur!.activities)).not.toContain(
      "path-0",
    );
  });
  it("rockfall cannot remove start or goals, and discards the path", () => {
    let s = setup();
    const id = give(s, "ROCKFALL");
    expect(() =>
      act(s, { type: "mineAction", cardId: id, cell: "0_0" }),
    ).toThrow();
    expect(() =>
      act(s, { type: "mineAction", cardId: id, cell: "8_0" }),
    ).toThrow();
    s.public.saboteur!.board["1_0"] = {
      x: 1,
      y: 0,
      cardId: "path-0",
      rotation: 0,
      type: "path",
    };
    s = act(s, { type: "mineAction", cardId: id, cell: "1_0" });
    expect(s.public.saboteur!.board["1_0"]).toBeUndefined();
    expect(s.secret.saboteur!.discard).toContain("path-0");
  });
  it("rejects forged cards, duplicate discards, bad phases and wrong players atomically", () => {
    const s = setup(),
      copy = structuredClone(s),
      cardId = s.saboteurPrivate!.p0.hand[0];
    for (const a of [
      { type: "minePass", cards: [] },
      { type: "minePass", cards: [cardId, cardId] },
      { type: "minePath", cardId: "fake", x: 1, y: 0, rotation: 0 },
      { type: "mineNext" },
    ] as MineAction[])
      expect(() => act(s, a)).toThrow();
    expect(() => act(s, { type: "minePass", cards: [cardId] }, "p1")).toThrow();
    expect(s).toEqual(copy);
  });
  it("reveals gold through a ladder reconnection and ends immediately", () => {
    let s = setup(),
      g = s.public.saboteur!;
    const ladder = MINE_CARDS.find((c) => c.kind === "path" && c.ladder)!;
    s.saboteurPrivate!.p0.hand = [ladder.id];
    s.secret.saboteur!.goals["8_0"] = "GOLD";
    for (const x of [6, 7])
      g.board[`${x}_0`] = {
        x,
        y: 0,
        type: "path",
        cardId: "path-0",
        rotation: 0,
      };
    s = act(s, {
      type: "minePath",
      cardId: ladder.id,
      x: 5,
      y: 0,
      rotation: 0,
    });
    g = s.public.saboteur!;
    expect(g.connector).toBe("p0");
    expect(g.board["8_0"].revealed).toBe("GOLD");
    expect(g.phase).toBe("ROUND_RESULT");
    expect(s.saboteurPrivate!.p0.hand).toHaveLength(0);
  });
});
describe("role awards and theft", () => {
  it.each([
    "BLUE_DIGGER",
    "GREEN_DIGGER",
    "BOSS",
    "PROFITEER",
    "SABOTEUR",
    "GEOLOGIST",
  ] as DwarfRole[])("resolves all door combinations for %s", (role) => {
    for (const blue of [false, true])
      for (const green of [false, true]) {
        const result = resolveColoredTeams(role, blue, green);
        expect(result.blue).toBe(blue && !(role === "GREEN_DIGGER" && green));
        expect(result.green).toBe(green && !(role === "BLUE_DIGGER" && blue));
      }
  });
  it("uses the share table, modifiers and trapped exclusions", () => {
    expect([1, 2, 3, 4, 5, 12].map(winnerShare)).toEqual([5, 4, 3, 2, 1, 1]);
    const s = setup(),
      g = s.public.saboteur!,
      p = s.saboteurPrivate!;
    p.p0.role = "SABOTEUR";
    p.p1.role = "PROFITEER";
    p.p2.role = "GEOLOGIST";
    p.p3.role = "GEOLOGIST";
    g.players.p0.effects.TRAPPED = { cardId: "a", sequence: 0 };
    const crystal = MINE_CARDS.find(
      (c) => c.kind === "path" && c.crystalCount === 2,
    )!;
    g.board["99_0"] = {
      x: 99,
      y: 0,
      type: "path",
      cardId: crystal.id,
      rotation: 0,
    };
    expect(calculateRoundGoldAwards(g, p).awards).toEqual({
      p0: 0,
      p1: 3,
      p2: 1,
      p3: 1,
    });
    g.players.p3.effects.TRAPPED = { cardId: "b", sequence: 1 };
    expect(calculateRoundGoldAwards(g, p).awards.p2).toBe(2);
  });
  it("awards Boss / Profiteer 3 / 2 when both teams are blocked, or 4 / 3 alone", () => {
    const s = setup(),
      g = s.public.saboteur!,
      p = s.saboteurPrivate!;
    g.connector = "p0";
    p.p0.role = "BOSS";
    p.p1.role = "PROFITEER";
    p.p2.role = "BLUE_DIGGER";
    p.p3.role = "GREEN_DIGGER";
    expect(calculateRoundGoldAwards(g, p).awards).toEqual({
      p0: 3,
      p1: 2,
      p2: 0,
      p3: 0,
    });
    g.players.p1.effects.TRAPPED = { cardId: "a", sequence: 1 };
    expect(calculateRoundGoldAwards(g, p).awards.p0).toBe(4);
    delete g.players.p1.effects.TRAPPED;
    g.players.p0.effects.TRAPPED = { cardId: "b", sequence: 2 };
    expect(calculateRoundGoldAwards(g, p).awards.p1).toBe(3);
  });
  it("orders theft newest then clockwise, excludes traps, and finishes third round after theft", () => {
    let s = setup();
    const g = s.public.saboteur!;
    for (let i = 0; i < 4; i++)
      g.players[`p${i}`].effects.THEFT = {
        cardId: `a${i}`,
        sequence: i === 1 ? 20 : i,
      };
    g.players.p3.effects.TRAPPED = { cardId: "trap", sequence: 0 };
    expect(theftOrder(g)).toEqual(["p1", "p2", "p0"]);
    g.phase = "THEFT_RESOLUTION";
    g.round = 3;
    g.theftQueue = ["p1"];
    s.saboteurPrivate!.p0.gold = 2;
    s.saboteurPrivate!.p1.gold = 0;
    expect(() => act(s, { type: "mineSteal", target: "p2" })).toThrow();
    s = act(s, { type: "mineSteal", target: "p0" });
    expect(s.public.saboteur!.phase).toBe("GAME_OVER");
    expect(s.public.saboteur!.winners).toEqual(["p0", "p1"]);
  });
});
describe("full matches and AI observations", () => {
  it.each([2, 5, 12])(
    "finishes three rounds with %i players in both difficulties, preserving every card",
    (count) => {
      for (const casual of [false, true])
        for (const seed of [7, 18]) {
          let s = setup(count, seed),
            steps = 0;
          const shuffle = rng(seed + 1);
          while (s.public.saboteur!.phase !== "GAME_OVER" && steps++ < 900) {
            const g = s.public.saboteur!;
            const allCards = [
              ...s.secret.saboteur!.deck,
              ...s.secret.saboteur!.removed,
              ...s.secret.saboteur!.discard,
              ...Object.values(s.saboteurPrivate!).flatMap((p) => p.hand),
              ...Object.values(g.board)
                .filter((t) => t.type === "path")
                .map((t) => t.cardId),
              ...Object.values(g.players).flatMap((p) =>
                Object.values(p.effects).map((e) => e!.cardId),
              ),
              ...(s.secret.saboteur!.pendingCard
                ? [s.secret.saboteur!.pendingCard]
                : []),
            ];
            expect(allCards.length).toBe(MINE_CARDS.length);
            expect(new Set(allCards).size).toBe(MINE_CARDS.length);
            if (g.phase === "ROUND_RESULT") {
              const starter = (g.order.indexOf(g.finalPlayer!) + 1) % count,
                gold = s.saboteurPrivate!.p0.gold;
              s = act(s, { type: "mineNext" }, "p0");
              expect(s.public.saboteur!.current).toBe(starter);
              expect(s.saboteurPrivate!.p0.gold).toBe(gold);
              continue;
            }
            const uid = mineActor(g),
              own = structuredClone(s.saboteurPrivate![uid]);
            const a = chooseMineAction(
              uid,
              structuredClone(g),
              own,
              shuffle,
              casual,
            );
            expect(a).toBeTruthy();
            s = applyMineAction(s, uid, a!, shuffle);
          }
          expect(s.public.saboteur!.round).toBe(3);
          expect(s.public.saboteur!.phase).toBe("GAME_OVER");
          expect(s.public.saboteur!.winners!.length).toBeGreaterThan(0);
          expect(Object.keys(s.public.saboteur!.totals!)).toHaveLength(count);
        }
    },
    120000,
  );
  it("bot cannot observe another private hand, role, hidden deck or goals", () => {
    const s = setup(),
      g = s.public.saboteur!,
      own = s.saboteurPrivate!.p0;
    const a = chooseMineAction("p0", g, own, identity);
    s.saboteurPrivate!.p1.role = "PROFITEER";
    s.saboteurPrivate!.p1.hand = [];
    s.secret.saboteur!.deck.reverse();
    s.secret.saboteur!.goals["8_0"] = "GOLD";
    expect(chooseMineAction("p0", g, own, identity)).toEqual(a);
    expect(MINE_CARDS.every((c) => MINE_CARD_BY_ID[c.id] === c)).toBe(true);
  });
});
