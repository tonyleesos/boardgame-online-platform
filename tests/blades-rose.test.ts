import { describe, expect, it } from "vitest";
import {
  startRose,
  applyRoseAction,
  roseWinner,
} from "../functions/src/bladesRose/engine";
import {
  PLAYER_COUNT_RULES,
  normalizeRosePrivate,
  canSubmitRose,
  type CrystalId,
  type RoseAction,
  type RoseCardType,
} from "../functions/src/shared/bladesRose";
import type { Session } from "../functions/src/shared/model";
import { leaveSeat } from "../functions/src/membership";
import { chooseRoseAction } from "../functions/src/bladesRose/bot";
import { advanceOneBot } from "../functions/src/bots";
const shuffle = <T>(v: T[]) => [...v];
function fixture(n = 8) {
  const s: Session = {
    public: {
      code: "ROSEAA",
      gameId: "blades-and-rose",
      hostId: "p0",
      status: "waiting",
      createdAt: 0,
      players: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `p${i}`,
          { uid: `p${i}`, nickname: `玩家${i}`, joinedAt: i, ready: true },
        ]),
      ),
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startRose(s, "test", shuffle);
  return s;
}
const act = (s: Session, uid: string, a: RoseAction) =>
  applyRoseAction(s, uid, a, shuffle);
function day(s = fixture()) {
  for (const uid of s.public.rose!.order) act(s, uid, { type: "roseNight" });
  return s;
}
function skill(id: CrystalId, owner = "p1") {
  const s = day();
  s.rosePrivate![owner].crystal = id;
  act(s, "p0", { type: "roseCoin", target: owner });
  act(s, owner, { type: "roseCrystal" });
  return s;
}
function finish(s: Session, choices: Record<string, RoseCardType> = {}) {
  const g = s.public.rose!;
  while (g.phase === "DECISIONS") {
    const uid = g.current,
      p = s.rosePrivate![uid];
    const card = choices[uid]
      ? p.hand.find((c) => c.type === choices[uid])
      : p.constraint.mustPlay
        ? p.hand.find((c) => canSubmitRose(p, c.id))
        : undefined;
    act(s, uid, { type: "roseDecide", ...(card ? { cardId: card.id } : {}) });
  }
  return s;
}
describe("Blades & Rose setup and privacy", () => {
  it("starts from an RTDB waiting room where empty secret branches were omitted", () => {
    const s = fixture();
    s.public.status = "waiting";
    delete (s as Partial<Session>).secret;
    expect(() => startRose(s, "restored", shuffle)).not.toThrow();
    expect(s.secret.rose?.spareBlade).toBe(true);
  });
  it.each([4, 11])("rejects %i players", (n) =>
    expect(() => fixture(n)).toThrow("5–10"),
  );
  it.each([5, 6, 7, 9, 10])(
    "keeps %i player rules unavailable without inventing values",
    (n) => {
      expect(PLAYER_COUNT_RULES[n].identities).toBeNull();
      expect(() => fixture(n)).toThrow("校對");
    },
  );
  it("deals unique instances, crystals, and independent identities", () => {
    const s = fixture();
    const ps = Object.values(s.rosePrivate!);
    expect(new Set(ps.flatMap((p) => p.hand.map((c) => c.id))).size).toBe(24);
    expect(new Set(ps.map((p) => p.crystal)).size).toBe(8);
    for (const p of ps)
      expect(p.hand.map((c) => c.type)).toEqual([
        "FOLLOWER",
        "GHOST",
        p.identity,
      ]);
    expect(
      ps
        .find((p) => p.identity === "FOLLOWER")!
        .hand.filter((c) => c.type === "FOLLOWER"),
    ).toHaveLength(2);
    expect(JSON.stringify(s.public)).not.toMatch(
      /identity|knownRoles|cardId|night|FOLLOWER/,
    );
  });
  it("requires all players ready and supports bot seats", () => {
    const s = fixture();
    s.public.status = "waiting";
    s.public.players.p0.ready = false;
    expect(() => startRose(s, "x", shuffle)).toThrow("準備");
    s.public.players.p0.ready = true;
    s.public.players.p1.isBot = true;
    expect(() => startRose(s, "x", shuffle)).not.toThrow();
  });
  it("recognizes only eligible players, without exact roles", () => {
    const s = fixture();
    for (const [uid, p] of Object.entries(s.rosePrivate!)) {
      expect(p.night.length).toBe(
        ["WHITE_ROSE", "BISHOP", "DOUBLE_BLADE", "GREAT_BLADE"].includes(
          p.identity,
        )
          ? 3
          : 0,
      );
      expect(p.night).not.toContain(uid);
      expect(p.knownRoles).toEqual({});
    }
  });
  it("exchanges the double blade ghost privately once", () => {
    const s = day();
    const p = s.rosePrivate!.p5;
    expect(p.identity).toBe("DOUBLE_BLADE");
    expect(p.hand.map((c) => c.type)).toEqual([
      "FOLLOWER",
      "DOUBLE_BLADE",
      "DOUBLE_BLADE",
    ]);
    expect(s.secret.rose!.ghostReserve).toBe(1);
    expect(() => act(s, "p5", { type: "roseNight" })).toThrow();
  });
  it("rejects wrong phase, out of turn, outsiders, own coin and repeated crystal", () => {
    const s = day();
    expect(() => act(s, "p1", { type: "roseCoin", target: "p2" })).toThrow();
    expect(() => act(s, "outsider", { type: "roseNight" })).toThrow();
    expect(() => act(s, "p0", { type: "roseCoin", target: "p0" })).toThrow();
    act(s, "p0", { type: "roseCoin", target: "p1" });
    expect(() => act(s, "p1", { type: "roseDecide" })).toThrow();
  });
  it("preserves empty arrays/maps through RTDB normalization", () => {
    const s = fixture();
    const p = s.rosePrivate!.p0;
    delete (p as Partial<typeof p>).hand;
    delete (p as Partial<typeof p>).constraint;
    expect(normalizeRosePrivate(p).hand).toEqual([]);
    expect(p.constraint).toEqual({});
  });
});
describe("round integrity", () => {
  it("hides play/pass until reveal, rejects double play and foreign cards", () => {
    const s = skill(6);
    const g = s.public.rose!,
      uid = g.current;
    const before = g.players[uid].handCount;
    expect(() =>
      act(s, uid, { type: "roseDecide", cardId: s.rosePrivate!.p0.hand[0].id }),
    ).toThrow();
    act(s, uid, { type: "roseDecide", cardId: s.rosePrivate![uid].hand[0].id });
    expect(g.players[uid].handCount).toBe(before);
    expect(g.players[uid].ready).toBe(true);
    expect(() => act(s, uid, { type: "roseDecide" })).toThrow();
  });
  it("anonymizes every normal reveal and keeps identities after play", () => {
    const s = skill(6);
    finish(s, { p0: "WHITE_ROSE", p2: "FOLLOWER", p3: "GHOST" });
    const g = s.public.rose!;
    expect(g.safeRose).toBe(true);
    expect(g.safeBuds).toBe(1);
    expect(s.rosePrivate!.p0.identity).toBe("WHITE_ROSE");
    expect(g.history[0].cards).toHaveLength(3);
    for (const c of g.history[0].cards) {
      expect(Object.keys(c).sort()).toEqual(["revealId", "type"]);
      expect(c.revealId).not.toContain("test-c");
    }
    expect(s.secret.rose!.contributions).toEqual({});
  });
  it("blade kills all buds but ghosts never score", () => {
    const s = skill(6);
    finish(s, {
      p2: "FOLLOWER",
      p1: "BISHOP",
      p5: "DOUBLE_BLADE",
      p3: "GHOST",
    });
    expect(s.public.rose!.deadBuds).toBe(2);
    expect(s.public.rose!.safeBuds).toBe(0);
  });
  it("White Rose and blade ends immediately", () => {
    const s = skill(6);
    finish(s, { p0: "WHITE_ROSE", p7: "DARK_BLADE" });
    expect(s.public.rose!.winner).toBe("BLOOD_BLADE");
    expect(s.public.status).toBe("finished");
    expect(s.public.rose!.roles!.p7).toBe("DARK_BLADE");
    expect(() => act(s, "p1", { type: "roseContinue" })).toThrow();
  });
  it("empty round resolves without manufacturing cards", () => {
    const s = skill(6);
    finish(s);
    expect(s.public.rose!.history[0].cards).toEqual([]);
    expect(s.public.rose!.safeBuds).toBe(0);
  });
  it("continues coin flow without reusing crystals", () => {
    const s = skill(6);
    finish(s);
    act(s, "p1", { type: "roseContinue" });
    expect(() => act(s, "p1", { type: "roseCoin", target: "p1" })).toThrow();
    act(s, "p1", { type: "roseCoin", target: "p2" });
    s.rosePrivate!.p2.crystal = 6;
    act(s, "p2", { type: "roseCrystal" });
    finish(s);
    act(s, "p2", { type: "roseContinue" });
    expect(() => act(s, "p2", { type: "roseCoin", target: "p1" })).toThrow();
  });
});
for (const id of [1, 12] as CrystalId[])
  describe(`crystal ${id}`, () => {
    it("requires a valid target and forces play", () => {
      const s = skill(id);
      expect(() =>
        act(s, "p1", { type: "roseTarget", targets: ["bad"] }),
      ).toThrow();
      act(s, "p1", { type: "roseTarget", targets: ["p1"] });
      expect(() => act(s, "p1", { type: "roseDecide" })).toThrow();
      act(s, "p1", {
        type: "roseDecide",
        cardId: s.rosePrivate!.p1.hand[0].id,
      });
    });
  });
describe("crystal 2", () => {
  it("reveals source attribution in decision order", () => {
    const s = skill(2);
    finish(s, { p1: "GHOST", p3: "FOLLOWER" });
    expect(s.public.rose!.history[0].cards.map((c) => c.sourceUid)).toEqual([
      "p1",
      "p3",
    ]);
  });
});
for (const [id, target] of [
  [3, "p2"],
  [4, "p0"],
] as const)
  describe(`crystal ${id}`, () => {
    it("locks only the server-selected neighbor card while allowing pass", () => {
      const s = skill(id);
      const p = s.rosePrivate![target];
      expect(p.constraint.lockedCardId).toBe(p.hand[0].id);
      expect(canSubmitRose(p, p.hand[1].id)).toBe(false);
      expect(canSubmitRose(p)).toBe(true);
      expect(JSON.stringify(s.public)).not.toContain(p.hand[0].id);
    });
  });
describe("crystal 5", () => {
  it.each([true, false])(
    "binds B to A even when B is seated before A, play=%s",
    (plays) => {
      const s = skill(5);
      act(s, "p1", { type: "roseTarget", targets: ["p4", "p2"] });
      const g = s.public.rose!;
      expect(g.queue.indexOf("p4")).toBeLessThan(g.queue.indexOf("p2"));
      while (g.current !== "p4") act(s, g.current, { type: "roseDecide" });
      act(s, "p4", {
        type: "roseDecide",
        ...(plays ? { cardId: s.rosePrivate!.p4.hand[0].id } : {}),
      });
      expect(g.current).toBe("p2");
      expect(canSubmitRose(s.rosePrivate!.p2)).toBe(!plays);
      expect(
        canSubmitRose(s.rosePrivate!.p2, s.rosePrivate!.p2.hand[0].id),
      ).toBe(plays);
    },
  );
  it("rejects duplicate targets", () => {
    const s = skill(5);
    expect(() =>
      act(s, "p1", { type: "roseTarget", targets: ["p2", "p2"] }),
    ).toThrow();
  });
});
describe("crystal 6", () => {
  it("moves skill owner to last without showing decisions", () => {
    const s = skill(6);
    expect(s.public.rose!.queue).toEqual([
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p0",
      "p1",
    ]);
  });
});
describe("crystal 7", () => {
  it("resolves without a target when the spare ghost is exhausted", () => {
    const s = day();
    s.secret.rose!.ghostReserve = 0;
    s.rosePrivate!.p1.crystal = 7;
    act(s, "p0", { type: "roseCoin", target: "p1" });
    act(s, "p1", { type: "roseCrystal" });
    expect(s.public.rose!.phase).toBe("DECISIONS");
    expect(s.rosePrivate!.p2.hand).toHaveLength(3);
  });
  it("transfers the single exchanged ghost from finite reserve", () => {
    const s = skill(7);
    expect(() =>
      act(s, "p1", { type: "roseTarget", targets: ["p1"] }),
    ).toThrow();
    act(s, "p1", { type: "roseTarget", targets: ["p5"] });
    expect(s.secret.rose!.ghostReserve).toBe(0);
    expect(
      s.rosePrivate!.p5.hand.filter((c) => c.type === "GHOST"),
    ).toHaveLength(1);
    expect(s.rosePrivate!.p5.hand).toHaveLength(4);
  });
});
describe("crystal 8", () => {
  it("forces both fixed-seat neighbors", () => {
    const s = skill(8);
    expect(s.rosePrivate!.p0.constraint.mustPlay).toBe(true);
    expect(s.rosePrivate!.p2.constraint.mustPlay).toBe(true);
    expect(s.rosePrivate!.p3.constraint).toEqual({});
  });
});
describe("crystal 9", () => {
  it("gives exact roles only to Dark Blade even after identity card was played", () => {
    const s = day();
    s.rosePrivate!.p7.hand = [];
    s.rosePrivate!.p1.crystal = 9;
    act(s, "p0", { type: "roseCoin", target: "p1" });
    act(s, "p1", { type: "roseCrystal" });
    expect(s.rosePrivate!.p7.knownRoles).toEqual({
      p0: "WHITE_ROSE",
      p1: "BISHOP",
    });
    for (const uid of s.public.rose!.order.filter((u) => u !== "p7"))
      expect(s.rosePrivate![uid].knownRoles).toEqual({});
    expect(JSON.stringify(s.public)).not.toMatch(
      /knownRoles|WHITE_ROSE|BISHOP/,
    );
  });
});
describe("crystal 10", () => {
  it("offers replacement only after all decisions; swaps without revealing card", () => {
    const s = skill(10);
    expect(() =>
      act(s, "p1", { type: "roseReplaceTarget", target: "p2" }),
    ).toThrow();
    const original = s.rosePrivate!.p2.hand[0];
    finish(s, { p2: "FOLLOWER" });
    expect(s.public.rose!.phase).toBe("REPLACE_TARGET");
    expect(s.rosePrivate!.p1.replacementTargets).toEqual(["p2"]);
    expect(() =>
      act(s, "p1", { type: "roseReplaceTarget", target: "p3" }),
    ).toThrow();
    act(s, "p1", { type: "roseReplaceTarget", target: "p2" });
    const ghost = s.rosePrivate!.p2.hand.find((c) => c.type === "GHOST")!;
    act(s, "p2", { type: "roseReplaceCard", cardId: ghost.id });
    expect(s.rosePrivate!.p2.hand).toContainEqual(original);
    expect(s.public.rose!.history[0].cards[0].type).toBe("GHOST");
  });
  it("can decline, including when no targets exist", () => {
    const s = skill(10);
    finish(s);
    expect(s.rosePrivate!.p1.replacementTargets).toEqual([]);
    act(s, "p1", { type: "roseReplaceTarget" });
    expect(s.public.rose!.phase).toBe("ROUND_RESULT");
  });
});
describe("crystal 11", () => {
  it("persists pending peek privately through reconnect and removes after ack", () => {
    const s = skill(11),
      before = structuredClone(s.rosePrivate!.p3.hand);
    act(s, "p1", { type: "roseTarget", targets: ["p3"] });
    expect(s.rosePrivate!.p1.peek).toEqual({ target: "p3", type: "FOLLOWER" });
    const restored = JSON.parse(JSON.stringify(s)) as Session;
    expect(normalizeRosePrivate(restored.rosePrivate!.p1).peek).toBeDefined();
    expect(JSON.stringify(s.public)).not.toContain("FOLLOWER");
    expect(s.rosePrivate!.p3.hand).toEqual(before);
    act(restored, "p1", { type: "rosePeek" });
    expect(restored.rosePrivate!.p1.peek).toBeUndefined();
    expect(restored.public.rose!.phase).toBe("DECISIONS");
  });
});
describe("victory and room lifecycle", () => {
  it.each([
    [true, 5, 0, "WHITE_ROSE"],
    [true, 4, 0, undefined],
    [false, 8, 0, undefined],
    [false, 0, 6, "BLOOD_BLADE"],
    [false, 0, 5, undefined],
  ] as const)(
    "evaluates thresholds %s %i %i",
    (safeRose, safeBuds, deadBuds, winner) => {
      const s = fixture();
      Object.assign(s.public.rose!, { safeRose, safeBuds, deadBuds });
      expect(roseWinner(s.public.rose!, s.rosePrivate!)?.winner).toBe(winner);
    },
  );
  it.each([true, false])(
    "final crystal checks white faction unresolved flowers: %s",
    (remaining) => {
      const s = fixture(),
        g = s.public.rose!;
      for (const p of Object.values(g.players)) p.crystalUsed = true;
      for (const p of Object.values(s.rosePrivate!))
        if (p.faction === "WHITE_ROSE" && !remaining) p.hand = [];
      expect(roseWinner(g, s.rosePrivate!)?.winner).toBe(
        remaining ? "BLOOD_BLADE" : "WHITE_ROSE",
      );
    },
  );
  it("plays a full eight-crystal game without deadlock", () => {
    const s = day(),
      g = s.public.rose!;
    const owners = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p0"];
    for (const owner of owners) {
      act(s, g.coin, { type: "roseCoin", target: owner });
      act(s, owner, { type: "roseCrystal" });
      if (g.phase === "TARGET")
        act(s, owner, {
          type: "roseTarget",
          targets:
            g.crystal === 5
              ? ["p0", "p1"]
              : [g.order.find((id) => id !== owner)!],
        });
      finish(s);
      if (g.phase === "ROUND_RESULT") act(s, owner, { type: "roseContinue" });
    }
    expect(g.phase).toBe("GAME_OVER");
    expect(g.round).toBe(8);
  });
  it("ends safely on explicit departure without proxy bots or revealing secrets", () => {
    const s = skill(11);
    act(s, "p1", { type: "roseTarget", targets: ["p2"] });
    leaveSeat(s, "p0");
    expect(s.public.status).toBe("finished");
    expect(s.public.rose!.aborted).toBe(true);
    expect(s.public.rose!.roles).toBeUndefined();
    expect(s.public.hostId).toBe("p1");
    expect(s.rosePrivate!.p0).toBeUndefined();
    expect(s.rosePrivate!.p1.peek).toBeUndefined();
  });
});
describe("AI practice and fair information boundary", () => {
  function random(seed: number) {
    return <T>(items: T[]) => {
      const v = [...items];
      for (let i = v.length - 1; i > 0; i--) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const j = seed % (i + 1);
        [v[i], v[j]] = [v[j], v[i]];
      }
      return v;
    };
  }
  it.each([false, true])(
    "completes 40 complete seeded practice matches, casual=%s",
    (casual) => {
      for (let seed = 1; seed <= 40; seed++) {
        const s = fixture();
        s.public.status = "waiting";
        s.public.botLevel = casual ? "casual" : "standard";
        for (const player of Object.values(s.public.players))
          player.isBot = true;
        const rng = random(seed);
        startRose(s, `ai-${seed}`, rng);
        let steps = 0;
        while (s.public.status === "playing" && steps++ < 180)
          expect(advanceOneBot(s, rng)).toBe(true);
        expect(s.public.status).toBe("finished");
        expect(s.public.rose!.winner).toBeDefined();
        expect(s.public.rose!.round).toBeLessThanOrEqual(8);
        expect(
          (s.public.activity ?? []).some((a) =>
            /FOLLOWER|WHITE_ROSE|cardId|crystalSkill|BISHOP/.test(a.message),
          ),
        ).toBe(false);
      }
    },
  );
  it("policy is unchanged when opponents private data changes", () => {
    const s = skill(6);
    const uid = s.public.rose!.current;
    const own = structuredClone(s.rosePrivate![uid]);
    const before = chooseRoseAction(
      uid,
      structuredClone(s.public.rose!),
      own,
      shuffle,
    );
    for (const [id, p] of Object.entries(s.rosePrivate!))
      if (id !== uid) {
        p.identity = "DARK_BLADE";
        p.crystal = 12;
        p.hand = [];
      }
    s.secret.rose!.contributions = {};
    expect(
      chooseRoseAction(uid, structuredClone(s.public.rose!), own, shuffle),
    ).toEqual(before);
  });
  it("does not act for the human or while waiting for another seat", () => {
    const s = skill(6);
    expect(
      chooseRoseAction("p1", s.public.rose!, s.rosePrivate!.p1, shuffle),
    ).toBeNull();
    s.public.players.p1.isBot = true;
    expect(advanceOneBot(s, shuffle)).toBe(false);
  });
});
