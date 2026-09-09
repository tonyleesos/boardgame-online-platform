import { describe, it, expect } from "vitest";
import {
  startBomb,
  applyBombAction,
  normalizeBomb,
} from "../functions/src/timebomb-engine";
import { startGame } from "../functions/src/engine";
import {
  advanceOneBot,
  chooseBombAction,
  chooseAvalonAction,
} from "../functions/src/bots";
import type { Session } from "../functions/src/shared/model";
import type {
  BombVariant,
  Wire,
  BombAction,
} from "../functions/src/shared/timebomb";
const same = <T>(a: T[]) => a;
function fresh(n = 4, variant: BombVariant = "standard") {
  const s: Session = {
    public: {
      code: "ABC234",
      gameId: "timebomb",
      hostId: "p0",
      status: "waiting",
      createdAt: 1,
      players: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `p${i}`,
          { uid: `p${i}`, nickname: `P${i}`, joinedAt: i, ready: true },
        ]),
      ),
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startBomb(s, "bomb-game", same, variant);
  return s;
}
function ready(s: Session) {
  for (const id of s.public.timebomb!.order)
    applyBombAction(s, id, { type: "bombReveal" }, same);
  for (const id of s.public.timebomb!.order)
    applyBombAction(s, id, { type: "claim", successes: 0 }, same);
}
function cut(s: Session, wire: Wire) {
  const g = s.public.timebomb!;
  g.phase = "CUT";
  g.scissorsId = "p0";
  s.secret.bombHands!.p1[0] = wire;
  g.hands.p1 = [0, 1, 2, 3, 4];
  return applyBombAction(s, "p0", { type: "cut", target: "p1", slot: 0 }, same);
}
function seeded(seed: number) {
  return <T>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
}
describe("Time Bomb setup and hidden information", () => {
  it.each([4, 5, 6])(
    "%i players get five cards and exactly N success wires",
    (n) => {
      const s = fresh(n),
        g = s.public.timebomb!,
        cards = Object.values(s.secret.bombHands!).flat();
      expect(g.colors).toHaveLength(n);
      expect(cards).toHaveLength(n * 5);
      expect(cards.filter((c) => c === "success")).toHaveLength(n);
      expect(Object.keys(s.timebombPrivate!)).toHaveLength(n);
      for (const p of Object.values(s.timebombPrivate!))
        expect(Object.values(p.inventory).reduce((a, b) => a + b, 0)).toBe(5);
      expect(JSON.stringify(s.public)).not.toMatch(
        /sherlock|moriarty|inventory|bombHands/,
      );
      expect(JSON.stringify(s.timebombPrivate)).not.toMatch(/slot|bombHands/);
    },
  );
  it("four-player game can have one or two evil players", () => {
    const counts = new Set<number>();
    for (let i = 1; i <= 30; i++) {
      const s = fresh();
      s.public.status = "waiting";
      startBomb(s, "g", seeded(i), "standard");
      counts.add(
        Object.values(s.timebombPrivate!).filter((p) => p.role === "moriarty")
          .length,
      );
    }
    expect([...counts].sort()).toEqual([1, 2]);
  });
  it("rejects invalid player counts", () => {
    expect(() => fresh(3)).toThrow();
    expect(() => fresh(7)).toThrow();
  });
  it("blocks wrong phases, duplicate claims, self-cutting and other users turns", () => {
    const s = fresh();
    expect(() =>
      applyBombAction(s, "p0", { type: "cut", target: "p1", slot: 0 }, same),
    ).toThrow();
    ready(s);
    expect(() =>
      applyBombAction(s, "p0", { type: "claim", successes: 0 }, same),
    ).toThrow();
    expect(() =>
      applyBombAction(s, "p1", { type: "cut", target: "p2", slot: 0 }, same),
    ).toThrow();
    expect(() =>
      applyBombAction(s, "p0", { type: "cut", target: "p0", slot: 0 }, same),
    ).toThrow();
    expect(() =>
      applyBombAction(s, "p0", { type: "cut", target: "p1", slot: 9 }, same),
    ).toThrow();
  });
  it("forbids changing a claim but allows bluffing", () => {
    const s = fresh();
    for (const id of s.public.timebomb!.order)
      applyBombAction(s, id, { type: "bombReveal" }, same);
    applyBombAction(s, "p0", { type: "claim", successes: 5 }, same);
    expect(s.public.timebomb!.claims.p0).toBe(5);
    expect(() =>
      applyBombAction(s, "p0", { type: "claim", successes: 0 }, same),
    ).toThrow();
    expect(() =>
      applyBombAction(s, "p1", { type: "claim", successes: 6 }, same),
    ).toThrow();
  });
  it("normalizes sparse Firebase card slots without revealing order", () => {
    const s = fresh();
    s.secret.bombHands!.p1 = { 4: "green" } as unknown as Wire[];
    normalizeBomb(s);
    expect(s.secret.bombHands!.p1).toEqual([null, null, null, null, "green"]);
  });
});
describe("Time Bomb victory and effects", () => {
  it("four same-color bombs lose; the last success wins even on final turn", () => {
    const s = fresh();
    ready(s);
    s.public.timebomb!.bombs.green = 3;
    cut(s, "green");
    expect(s.public.timebomb!.winner).toBe("evil");
    const t = fresh();
    ready(t);
    Object.assign(t.public.timebomb!, { round: 4, cuts: 3, successes: 3 });
    cut(t, "success");
    expect(t.public.timebomb!.winner).toBe("good");
  });
  it("fourth round expires after its last cut", () => {
    const s = fresh();
    ready(s);
    Object.assign(s.public.timebomb!, { round: 4, cuts: 3 });
    cut(s, "yellow");
    expect(s.public.timebomb!.winner).toBe("evil");
  });
  it("green explodes on three only in evolution and respects defusing", () => {
    for (const variant of ["standard", "evolution"] as const) {
      const s = fresh(4, variant);
      ready(s);
      s.public.timebomb!.bombs.green = 2;
      cut(s, "green");
      expect(s.public.status).toBe(
        variant === "standard" ? "playing" : "finished",
      );
    }
    const s = fresh(4, "evolution");
    ready(s);
    s.public.timebomb!.bombs.green = 2;
    s.public.timebomb!.defused.green = true;
    cut(s, "green");
    expect(s.public.status).toBe("playing");
  });
  it("pink consecutive bombs explode despite protection and across rounds", () => {
    const s = fresh(4, "evolution");
    ready(s);
    const g = s.public.timebomb!;
    g.defused.pink = true;
    g.round = 2;
    g.history = [
      { round: 1, actor: "p0", target: "p1", slot: 0, wire: "pink" },
    ];
    cut(s, "pink");
    expect(g.winner).toBe("evil");
  });
  it("success must defuse a revealed unprotected non-yellow color", () => {
    const s = fresh(4, "evolution");
    ready(s);
    s.public.timebomb!.bombs = { green: 1, yellow: 1 };
    cut(s, "success");
    expect(s.public.timebomb!.phase).toBe("DEFUSE");
    expect(() =>
      applyBombAction(s, "p1", { type: "defuse", color: "green" }, same),
    ).toThrow();
    expect(() =>
      applyBombAction(s, "p0", { type: "defuse", color: "yellow" }, same),
    ).toThrow();
    applyBombAction(s, "p0", { type: "defuse", color: "green" }, same);
    expect(s.public.timebomb!.defused.green).toBe(true);
  });
  it("early success without a defusable bomb still counts", () => {
    const s = fresh(4, "evolution");
    ready(s);
    cut(s, "success");
    expect(s.public.timebomb).toMatchObject({
      successes: 1,
      phase: "CUT_RESULT",
    });
  });
  it("blue removes protection and can immediately explode the rearmed color", () => {
    const s = fresh(6, "evolution");
    ready(s);
    const g = s.public.timebomb!;
    g.defused.green = true;
    g.bombs.green = 3;
    cut(s, "blue");
    expect(g.phase).toBe("REARM");
    applyBombAction(s, "p0", { type: "rearm", color: "green" }, same);
    expect(g.winner).toBe("evil");
  });
  it("blue without protection has no extra effect", () => {
    const s = fresh(6, "evolution");
    ready(s);
    cut(s, "blue");
    expect(s.public.timebomb!.phase).toBe("CUT_RESULT");
  });
  it("red can force a self-cut and then clears the restriction", () => {
    const s = fresh(6, "evolution");
    ready(s);
    cut(s, "red");
    const g = s.public.timebomb!;
    expect(g.forcedTarget).toBe("p0");
    applyBombAction(s, "p0", { type: "bombContinue" }, same);
    expect(() =>
      applyBombAction(s, "p1", { type: "cut", target: "p2", slot: 0 }, same),
    ).toThrow();
    // Explicitly exercise the number-zero draw with the next cutter.
    g.forcedTarget = "p1";
    s.secret.bombHands!.p1[1] = "yellow";
    applyBombAction(s, "p1", { type: "cut", target: "p1", slot: 1 }, same);
    expect(g.forcedTarget).toBeUndefined();
    expect(g.scissorsId).toBe("p1");
  });
  it("red targeting an empty hand transfers scissors without an extra cut", () => {
    const s = fresh(6, "evolution");
    ready(s);
    s.public.timebomb!.hands.p0 = [];
    s.secret.bombHands!.p0 = [];
    cut(s, "red");
    expect(s.public.timebomb).toMatchObject({ scissorsId: "p0", cuts: 1 });
    expect(s.public.timebomb!.forcedTarget).toBeUndefined();
  });
  it("red target survives redealing and last recipient starts the next round", () => {
    const s = fresh(6, "evolution");
    ready(s);
    const g = s.public.timebomb!;
    for (const id of g.order) {
      s.secret.bombHands![id] = Array<Wire>(4).fill("yellow");
      g.hands[id] = [0, 1, 2, 3];
    }
    s.secret.bombHands!.p1.push("red");
    g.hands.p1.push(4);
    g.cuts = 5;
    applyBombAction(s, "p0", { type: "cut", target: "p1", slot: 4 }, same);
    expect(g.forcedTarget).toBe("p0");
    applyBombAction(s, "p0", { type: "bombContinue" }, same);
    expect(g).toMatchObject({
      round: 2,
      scissorsId: "p1",
      forcedTarget: "p0",
      phase: "CLAIMS",
    });
    expect(g.order.every((id) => g.hands[id].length === 4)).toBe(true);
  });
  it("orange fixes the fourth-round limit at entry, even while protected", () => {
    const s = fresh(4, "evolution");
    ready(s);
    const g = s.public.timebomb!;
    g.round = 3;
    g.cuts = 3;
    g.bombs.orange = 2;
    g.defused.orange = true;
    for (const id of g.order) {
      s.secret.bombHands![id] = Array<Wire>(2).fill("yellow");
      g.hands[id] = [0, 1];
    }
    s.secret.bombHands!.p1.push("yellow");
    g.hands.p1.push(2);
    applyBombAction(s, "p0", { type: "cut", target: "p1", slot: 2 }, same);
    applyBombAction(s, "p0", { type: "bombContinue" }, same);
    expect(g).toMatchObject({ round: 4, cutLimit: 2 });
    expect(g.hands.p0).toHaveLength(2);
  });
});
describe("original Time Bomb rules", () => {
  it.each([4, 5, 6, 7, 8])(
    "%i players receive the original deck and roles",
    (n) => {
      const s = fresh(n, "classic");
      const cards = Object.values(s.secret.bombHands!).flat();
      expect(cards.filter((w) => w === "bomb")).toHaveLength(1);
      expect(cards.filter((w) => w === "success")).toHaveLength(n);
      expect(cards.filter((w) => w === "safe")).toHaveLength(4 * n - 1);
      expect(s.public.timebomb!.colors).toEqual([]);
      const good = Object.values(s.timebombPrivate!).filter(
        (p) => p.role === "sherlock",
      ).length;
      expect(good).toBe(n >= 7 ? 5 : n === 6 ? 4 : 3);
    },
  );
  it("seven-player roles hide whether there are two or three opponents", () => {
    const counts = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const s = fresh(7, "classic");
      s.public.status = "waiting";
      startBomb(s, "seven", seeded(seed), "classic");
      counts.add(
        Object.values(s.timebombPrivate!).filter((p) => p.role === "moriarty")
          .length,
      );
    }
    expect([...counts].sort()).toEqual([2, 3]);
  });
  it("one bomb immediately ends the game", () => {
    const s = fresh(8, "classic");
    ready(s);
    cut(s, "bomb");
    expect(s.public.timebomb).toMatchObject({
      phase: "GAME_OVER",
      winner: "evil",
      cuts: 1,
    });
  });
  it("safe wires do nothing and the target receives the scissors", () => {
    const s = fresh(4, "classic");
    ready(s);
    cut(s, "safe");
    expect(s.public.timebomb).toMatchObject({
      phase: "CUT_RESULT",
      successes: 0,
      bombs: {},
      scissorsId: "p1",
    });
  });
  it("all defusing wires win even on the final cut of round four", () => {
    const s = fresh(4, "classic");
    ready(s);
    const g = s.public.timebomb!;
    g.round = 4;
    g.cuts = 3;
    g.successes = 3;
    cut(s, "success");
    expect(g).toMatchObject({ phase: "GAME_OVER", winner: "good" });
  });
  it("round four without every defusing wire loses", () => {
    const s = fresh(4, "classic");
    ready(s);
    const g = s.public.timebomb!;
    g.round = 4;
    g.cuts = 3;
    cut(s, "safe");
    expect(g).toMatchObject({ phase: "GAME_OVER", winner: "evil" });
  });
  it("classic accepts eight players while Evolution still rejects seven", () => {
    expect(() => fresh(8, "classic")).not.toThrow();
    expect(() => fresh(9, "classic")).toThrow();
    expect(() => fresh(7, "evolution")).toThrow();
  });
});
describe("fair AI policies and complete games", () => {
  it.each(["standard", "evolution", "classic"] as const)(
    "AI can complete many %s games without invalid actions",
    (variant) => {
      for (let seed = 1; seed <= 20; seed++) {
        const s = fresh(4 + (seed % (variant === "classic" ? 5 : 3)), variant),
          rng = seeded(seed);
        s.public.status = "waiting";
        startBomb(s, "g", rng, variant);
        Object.values(s.public.players).forEach((p) => {
          p.isBot = true;
        });
        for (
          let step = 0;
          step < 200 && s.public.status === "playing";
          step++
        ) {
          if (s.public.timebomb!.phase === "CUT_RESULT")
            applyBombAction(s, "p0", { type: "bombContinue" }, rng);
          else expect(advanceOneBot(s, rng)).toBe(true);
        }
        expect(s.public.status).toBe("finished");
        expect(["good", "evil"]).toContain(s.public.timebomb!.winner);
      }
    },
  );
  it("Avalon bots obey the same phase engine through a complete game", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = fresh(5),
        rng = seeded(seed);
      delete s.public.timebomb;
      s.public.gameId = "avalon";
      s.public.status = "waiting";
      startGame(s, "g", rng);
      Object.values(s.public.players).forEach((p) => {
        p.isBot = true;
      });
      for (let step = 0; step < 200 && s.public.status === "playing"; step++)
        expect(advanceOneBot(s, rng)).toBe(true);
      expect(s.public.status).toBe("finished");
    }
  });
  it("bomb policy uses claims and samples slots; it cannot inspect hidden wires", () => {
    const s = fresh();
    ready(s);
    const g = s.public.timebomb!;
    g.claims = { p0: 0, p1: 1, p2: 2, p3: 0 };
    const first = chooseBombAction("p0", g, s.timebombPrivate!.p0, same);
    s.secret.bombHands!.p2.reverse();
    s.timebombPrivate!.p2.role = "moriarty";
    expect(chooseBombAction("p0", g, s.timebombPrivate!.p0, same)).toEqual(
      first,
    );
    expect(first?.type).toBe("cut");
  });
  it("a good Avalon bot can never submit Fail; evil bot sees only its allowed knowledge", () => {
    const s = fresh(5);
    s.public.status = "waiting";
    startGame(s, "a", same);
    const g = s.public.game!;
    g.phase = "MISSION_VOTE";
    g.selectedPlayerIds = ["p0", "p3"];
    expect(chooseAvalonAction("p0", g, s.private.p0, same)).toEqual({
      type: "missionVote",
      vote: "success",
    });
    const before = chooseAvalonAction("p3", g, s.private.p3, same);
    s.private.p0.role = "servant";
    expect(chooseAvalonAction("p3", g, s.private.p3, same)).toEqual(before);
  });
  it("unknown actions are rejected", () => {
    const s = fresh();
    ready(s);
    expect(() =>
      applyBombAction(
        s,
        "p0",
        { type: "hacked" } as unknown as BombAction,
        same,
      ),
    ).toThrow();
  });
});
