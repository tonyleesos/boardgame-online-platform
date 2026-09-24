import { describe, it, expect } from "vitest";
import type { Session } from "../functions/src/shared/model";
import {
  startDance,
  applyDanceAction,
  buildRoundDeck,
  requiredDanceCards,
  findCriminalHolder,
  calculateDanceScores,
  validateDanceConfig,
} from "../functions/src/criminalDance/engine";
import { chooseDanceAction } from "../functions/src/criminalDance/bot";
import { leaveSeat } from "../functions/src/membership";
import {
  BASE_DANCE_COUNTS,
  DANCE_CARD_BY_ID,
  normalizeDance,
  normalizeDancePrivate,
  type DanceAction,
} from "../functions/src/shared/criminalDance";
const identity = <T>(a: readonly T[]) => [...a];
function rng(seed: number) {
  return <T>(a: readonly T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
}
function setup(count = 3, boy = false, policeChiefEnabled = false) {
  const s: Session = {
    public: {
      code: "DANCE2",
      gameId: "criminal-dance",
      hostId: "p0",
      status: "waiting",
      createdAt: 0,
      danceConfig: { targetScore: 5, boy, policeChiefEnabled },
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
  startDance(s, "test", identity);
  return s;
}
function fixture(hands: string[][]) {
  const s = setup(hands.length),
    g = s.public.dance!;
  g.firstPlay = false;
  g.current = "p0";
  hands.forEach((hand, i) => {
    s.dancePrivate![`p${i}`].hand = hand;
    g.players[`p${i}`].handCount = hand.length;
  });
  return s;
}
const act = (s: Session, a: DanceAction, uid = s.public.dance!.current) =>
  applyDanceAction(s, uid, a, identity);
function conserve(s: Session) {
  const g = s.public.dance!,
    p = s.dancePrivate!;
  const all = [
    ...Object.values(p).flatMap((v) => v.hand),
    ...g.played.map((v) => v.cardId),
    ...s.secret.dance!.excluded,
  ];
  expect(all).toHaveLength(32);
  expect(new Set(all).size).toBe(32);
  expect(all.filter((id) => id === "CRIMINAL-0")).toHaveLength(1);
  for (const id of g.order) {
    expect(g.players[id].handCount).toBe(p[id].hand.length);
    expect(p[id].revision).toBe(g.revision);
  }
}
describe("Criminal Dance rules and privacy", () => {
  it("eight-player RTDB serialization can omit the entire empty secret branch", () => {
    const s = setup(8);
    delete (s as Partial<Session>).secret;
    const next = act(s, { type: "dancePlay", cardId: "FIRST_DISCOVERER-0" });
    expect(next.public.dance!.revision).toBe(1);
    conserve(next);
  });
  it("departure aborts the match, clears pending secrets, preserves remaining revision and transfers host", () => {
    let s = fixture([["WITNESS-0", "ALIBI-0"], ["CRIMINAL-0"], ["RUMOR-0"]]);
    s = act(s, { type: "dancePlay", cardId: "WITNESS-0" });
    s = act(s, { type: "danceTarget", target: "p1" });
    const after = leaveSeat(s, "p1")!;
    expect(after.public.dance!.aborted).toBe(true);
    expect(after.dancePrivate!.p0.witness).toBeUndefined();
    expect(after.dancePrivate!.p0.revision).toBe(after.public.dance!.revision);
    expect(after.dancePrivate!.p1).toBeUndefined();
    const remaining = leaveSeat(after, "p0")!;
    expect(remaining.public.hostId).toBe("p2");
  });
  it.each([3, 4, 5, 6, 7, 8])(
    "deals four to %i with mandatory cards and hidden exclusions",
    (count) => {
      for (const boy of [false, true]) {
        const d = buildRoundDeck(count, rng(count), boy);
        expect(d.cards).toHaveLength(count * 4);
        expect(d.excluded).toHaveLength(32 - count * 4);
        for (const [type, n] of Object.entries(requiredDanceCards(count)))
          expect(
            d.cards.filter((id) => DANCE_CARD_BY_ID[id].type === type).length,
          ).toBeGreaterThanOrEqual(n!);
        const all = [...d.cards, ...d.excluded];
        for (const [type, n] of Object.entries(BASE_DANCE_COUNTS))
          expect(
            all.filter((id) => DANCE_CARD_BY_ID[id].type === type),
          ).toHaveLength(type === "WITNESS" && boy ? n - 1 : n);
        conserve(setup(count, boy));
      }
    },
  );
  it("requires first discoverer, own card, own turn and preserves input on rejection", () => {
    const s = setup(),
      g = s.public.dance!,
      before = structuredClone(s),
      owner = g.current;
    expect(() => act(s, { type: "dancePlay", cardId: "CRIMINAL-0" })).toThrow();
    expect(() =>
      act(
        s,
        { type: "dancePlay", cardId: "FIRST_DISCOVERER-0" },
        g.order.find((id) => id !== owner)!,
      ),
    ).toThrow();
    expect(() => act(s, { type: "dancePlay", cardId: "forged" })).toThrow();
    expect(s).toEqual(before);
    expect(
      act(s, { type: "dancePlay", cardId: "FIRST_DISCOVERER-0" }).public.dance!
        .firstPlay,
    ).toBe(false);
  });
  it("only escapes with criminal as sole card; accomplice activates on play", () => {
    let s = fixture([
      ["CRIMINAL-0", "ACCOMPLICE-0"],
      ["ORDINARY_PERSON-0"],
      ["ALIBI-0"],
    ]);
    expect(() => act(s, { type: "dancePlay", cardId: "CRIMINAL-0" })).toThrow();
    expect(s.public.dance!.players.p0.accomplice).toBe(false);
    s = act(s, { type: "dancePlay", cardId: "ACCOMPLICE-0" });
    s = act(s, { type: "dancePlay", cardId: "ORDINARY_PERSON-0" });
    s = act(s, { type: "dancePlay", cardId: "ALIBI-0" });
    s = act(s, { type: "dancePlay", cardId: "CRIMINAL-0" });
    expect(s.public.dance!.result?.awards).toEqual({ p0: 2, p1: 0, p2: 0 });
  });
  it("detective checks count before playing, not after", () => {
    const s = act(
      fixture([
        ["DETECTIVE-0", "ALIBI-0", "RUMOR-0", "TRADE-0"],
        ["CRIMINAL-0"],
        ["ALIBI-1"],
      ]),
      { type: "dancePlay", cardId: "DETECTIVE-0" },
    );
    expect(s.public.dance!.phase).toBe("PLAYER_TURN");
    expect(s.public.dance!.current).toBe("p1");
  });
  it("detective protected and innocent misses have identical public response, retaining alibi", () => {
    function miss(hand: string[]) {
      let s = fixture([
        ["DETECTIVE-0", "ALIBI-1"],
        hand,
        ["ORDINARY_PERSON-0"],
      ]);
      s = act(s, { type: "dancePlay", cardId: "DETECTIVE-0" });
      return act(s, { type: "danceTarget", target: "p1" });
    }
    const protectedState = miss(["CRIMINAL-0", "ALIBI-0"]),
      innocent = miss(["TRADE-0", "ALIBI-0"]);
    expect(protectedState.public).toEqual(innocent.public);
    expect(protectedState.dancePrivate!.p1.hand).toContain("ALIBI-0");
  });
  it("witness information is private and irrevocably removed after acknowledgement", () => {
    let s = fixture([["WITNESS-0", "ALIBI-0"], ["CRIMINAL-0"], ["RUMOR-0"]]);
    s = act(s, { type: "dancePlay", cardId: "WITNESS-0" });
    s = act(s, { type: "danceTarget", target: "p1" });
    expect(s.dancePrivate!.p0.witness?.cards).toEqual(["CRIMINAL-0"]);
    expect(s.dancePrivate!.p2.witness).toBeUndefined();
    expect(JSON.stringify(s.public)).not.toContain("CRIMINAL-0");
    expect(() => act(s, { type: "danceAcknowledge" }, "p1")).toThrow();
    s = act(s, { type: "danceAcknowledge" });
    expect(s.dancePrivate!.p0.witness).toBeUndefined();
    expect(() => act(s, { type: "danceAcknowledge" }, "p0")).toThrow();
  });
  it("dog ignores alibi on catch and transfers on miss, including legal self target", () => {
    let s = fixture([
      ["DOG-0", "ALIBI-0"],
      ["CRIMINAL-0", "ALIBI-1"],
      ["RUMOR-0"],
    ]);
    s = act(s, { type: "dancePlay", cardId: "DOG-0" });
    const caught = act(s, { type: "danceTarget", target: "p1" });
    expect(caught.public.dance!.result?.awards.p0).toBe(3);
    const missed = act(s, { type: "danceTarget", target: "p0" });
    expect(missed.dancePrivate!.p0.hand).toEqual(["DOG-0"]);
    expect(missed.public.dance!.played.map((c) => c.cardId)).toEqual([
      "ALIBI-0",
    ]);
    expect(missed.public.dance!.events.at(-1)?.cardId).toBe("ALIBI-0");
  });
  it("information choices stay private and only move atomically; empty hand can receive", () => {
    let s = fixture([
      ["INFORMATION_EXCHANGE-0"],
      ["CRIMINAL-0", "ALIBI-0"],
      ["TRADE-0"],
    ]);
    s = act(s, { type: "dancePlay", cardId: "INFORMATION_EXCHANGE-0" });
    const hands = structuredClone(s.dancePrivate);
    s = act(s, { type: "danceSelect", cardId: "CRIMINAL-0" }, "p1");
    expect(s.dancePrivate!.p1.hand).toEqual(hands!.p1.hand);
    expect(JSON.stringify(s.public)).not.toContain("CRIMINAL-0");
    expect(() =>
      act(s, { type: "danceSelect", cardId: "ALIBI-0" }, "p1"),
    ).toThrow();
    expect(() =>
      act(s, { type: "danceSelect", cardId: "CRIMINAL-0" }, "p2"),
    ).toThrow();
    s = act(s, { type: "danceSelect", cardId: "TRADE-0" }, "p2");
    expect(s.dancePrivate!.p0.hand).toEqual(["TRADE-0"]);
    expect(s.dancePrivate!.p1.hand).toEqual(["ALIBI-0"]);
    expect(s.dancePrivate!.p2.hand).toEqual(["CRIMINAL-0"]);
    expect(findCriminalHolder(s.dancePrivate!)).toBe("p2");
    expect(s.secret.dance!.snapshot).toBeUndefined();
    expect(s.dancePrivate!.p1.selection).toBeUndefined();
    expect(s.public.dance!.events.at(-1)?.transfers).toEqual([
      { from: "p1", to: "p2" },
      { from: "p2", to: "p0" },
    ]);
  });
  it("trade uses two secret choices, leaves uninvolved player intact, and cannot swap when actor is empty", () => {
    let s = fixture([["TRADE-0", "CRIMINAL-0"], ["ALIBI-0"], ["RUMOR-0"]]);
    s = act(s, { type: "dancePlay", cardId: "TRADE-0" });
    s = act(s, { type: "danceTarget", target: "p1" });
    expect(() =>
      act(s, { type: "danceSelect", cardId: "RUMOR-0" }, "p2"),
    ).toThrow();
    s = act(s, { type: "danceSelect", cardId: "ALIBI-0" }, "p1");
    expect(s.dancePrivate!.p0.hand).toEqual(["CRIMINAL-0"]);
    s = act(s, { type: "danceSelect", cardId: "CRIMINAL-0" });
    expect(s.dancePrivate!.p0.hand).toEqual(["ALIBI-0"]);
    expect(s.dancePrivate!.p1.hand).toEqual(["CRIMINAL-0"]);
    expect(s.dancePrivate!.p2.hand).toEqual(["RUMOR-0"]);
    const empty = act(fixture([["TRADE-0"], ["CRIMINAL-0"], []]), {
      type: "dancePlay",
      cardId: "TRADE-0",
    });
    expect(empty.public.dance!.phase).toBe("EFFECT_RESULT");
  });
  it("rumor uses original snapshot and skips empty turns until cards return", () => {
    let s = fixture([["RUMOR-0"], ["CRIMINAL-0"], []]);
    s = act(s, { type: "dancePlay", cardId: "RUMOR-0" });
    expect(s.dancePrivate!.p1.hand).toEqual([]);
    expect(s.dancePrivate!.p2.hand).toEqual(["CRIMINAL-0"]);
    s = act(s, { type: "danceAcknowledge" });
    expect(s.public.dance!.current).toBe("p2");
  });
  it("scores ties and highest score at threshold, host controls next round, and boy snapshot remains initial", () => {
    let s = fixture([["CRIMINAL-0"], ["ALIBI-0"], ["RUMOR-0"]]);
    s.public.dance!.players.p1.accomplice = true;
    s.public.dance!.players.p0.score = 3;
    s.public.dance!.players.p1.score = 3;
    s = act(s, { type: "dancePlay", cardId: "CRIMINAL-0" });
    expect(s.public.status).toBe("finished");
    expect(s.public.dance!.winners).toEqual(["p0", "p1"]);
    expect(() => act(s, { type: "danceNext" })).toThrow();
    let b = setup(8, true);
    const boy = Object.keys(b.dancePrivate!).find(
      (id) => b.dancePrivate![id].boyInitial,
    )!;
    const initial = b.dancePrivate![boy].boyInitial;
    b.public.dance!.firstPlay = false;
    b.public.dance!.current = "p0";
    b.dancePrivate!.p0.hand = ["CRIMINAL-0"];
    b = act(b, { type: "dancePlay", cardId: "CRIMINAL-0" });
    expect(b.dancePrivate![boy].boyInitial).toBe(initial);
    expect(() => act(b, { type: "danceNext" }, "p1")).toThrow();
    b = act(b, { type: "danceNext" }, "p0");
    expect(b.public.dance!.round).toBe(2);
    expect(
      Object.values(b.dancePrivate!).every((p) => p.hand.length === 4),
    ).toBe(true);
  });
  it("scoring respects criminal, active accomplice allegiance", () => {
    const g = setup(4).public.dance!;
    g.players.p0.accomplice = true;
    g.players.p2.accomplice = true;
    expect(calculateDanceScores(g, "DETECTIVE_CAUGHT", "p0", "p1")).toEqual({
      p0: 0,
      p1: 0,
      p2: 0,
      p3: 1,
    });
    expect(calculateDanceScores(g, "CRIMINAL_ESCAPED", "p1", "p1")).toEqual({
      p0: 2,
      p1: 2,
      p2: 2,
      p3: 0,
    });
  });
  it.each([3, 4, 5, 6, 7, 8])(
    "AI completes seeded %i-player matches with card conservation and no hidden access",
    (count) => {
      for (let seed = 1; seed <= 12; seed++) {
        const shuffle = rng(seed);
        let s = setup(count, seed % 2 === 0, seed % 4 !== 0); // Exercise both expansions independently and together.
        let steps = 0;
        while (s.public.dance!.phase !== "MATCH_END" && steps++ < 800) {
          const g = normalizeDance(s.public.dance!);
          conserve(s);
          if (g.phase === "ROUND_END") {
            s = applyDanceAction(s, "p0", { type: "danceNext" }, shuffle);
            continue;
          }
          const uid =
            g.pending?.eligible.find((id) => !g.pending!.locked.includes(id)) ??
            g.current;
          const own = normalizeDancePrivate(s.dancePrivate![uid]);
          const action = chooseDanceAction(
            uid,
            structuredClone(g),
            structuredClone(own),
            shuffle,
            seed % 3 === 0,
          );
          expect(action, `${count}/${seed}/${g.phase}`).not.toBeNull();
          s = applyDanceAction(s, uid, action!, shuffle);
        }
        conserve(s);
        expect(s.public.dance!.phase).toBe("MATCH_END");
        expect(steps).toBeLessThan(800);
      }
    },
  );
});

describe("Police Chief expansion", () => {
  const policeFixture = (hands: string[][]) => {
    const s = fixture(hands);
    s.public.dance!.config.policeChiefEnabled = true;
    return s;
  };
  function mark(s: Session, target = "p1") {
    s = act(s, { type: "dancePlay", cardId: "POLICE_CHIEF-0" });
    expect(() => act(s, { type: "danceTarget", target: "p0" })).toThrow();
    s = act(s, { type: "danceTarget", target });
    expect(s.public.dance!.result).toBeUndefined();
    expect(s.secret.dance!.terminal).toBeUndefined();
    return act(s, { type: "danceAcknowledge" });
  }
  it.each([3, 8])(
    "replaces dog only, supports independent boy and old configs (%i players)",
    (count) => {
      for (const boy of [false, true]) {
        const d = buildRoundDeck(count, identity, boy, true),
          all = [...d.cards, ...d.excluded];
        expect(all).toHaveLength(32);
        expect(all).toContain("POLICE_CHIEF-0");
        expect(all).not.toContain("DOG-0");
        expect(all.includes("BOY-0")).toBe(boy);
        const s = setup(8, boy, true),
          holder = s.public.dance!.policeChiefHolderUid!;
        expect(s.dancePrivate![holder].hand).toContain("POLICE_CHIEF-0");
        expect(JSON.stringify(s.public)).not.toContain("ALIBI-0");
      }
      expect(
        validateDanceConfig({ targetScore: 5, boy: false }).policeChiefEnabled,
      ).toBe(false);
      expect(() =>
        validateDanceConfig({
          targetScore: 5,
          boy: false,
          policeChiefEnabled: "true",
        }),
      ).toThrow();
    },
  );
  it("forbids four-card use, permits three-card use without exposing target identity", () => {
    const s = policeFixture([
        ["POLICE_CHIEF-0", "ALIBI-0", "RUMOR-0", "TRADE-0"],
        ["CRIMINAL-0"],
        [],
      ]),
      before = structuredClone(s);
    expect(() =>
      act(s, { type: "dancePlay", cardId: "POLICE_CHIEF-0" }),
    ).toThrow();
    expect(s).toEqual(before);
    const a = mark(
      policeFixture([
        ["POLICE_CHIEF-0", "ALIBI-0", "TRADE-0"],
        ["CRIMINAL-0"],
        [],
      ]),
    );
    const b = mark(
      policeFixture([
        ["POLICE_CHIEF-0", "ALIBI-0", "TRADE-0"],
        ["RUMOR-0"],
        [],
      ]),
    );
    expect(a.public).toEqual(b.public);
    expect(a.public.dance!.policeChiefTargetUid).toBe("p1");
    expect(
      a.public.dance!.played.find((c) => c.cardId === "POLICE_CHIEF-0")?.uid,
    ).toBe("p1");
  });
  it.each(["TRADE", "INFORMATION_EXCHANGE", "RUMOR"] as const)(
    "publishes only the new holder after atomic %s",
    (type) => {
      let s = policeFixture([
        [`${type}-0`, "POLICE_CHIEF-0"],
        ["CRIMINAL-0"],
        ["ALIBI-0"],
      ]);
      s = act(s, { type: "dancePlay", cardId: `${type}-0` });
      if (type === "TRADE") {
        s = act(s, { type: "danceTarget", target: "p1" });
        s = act(s, { type: "danceSelect", cardId: "POLICE_CHIEF-0" });
        expect(s.public.dance!.policeChiefHolderUid).toBe("p0");
        s = act(s, { type: "danceSelect", cardId: "CRIMINAL-0" }, "p1");
      } else if (type === "INFORMATION_EXCHANGE") {
        for (const [uid, cardId] of [
          ["p0", "POLICE_CHIEF-0"],
          ["p1", "CRIMINAL-0"],
          ["p2", "ALIBI-0"],
        ])
          s = act(s, { type: "danceSelect", cardId }, uid);
      }
      expect(s.public.dance!.policeChiefHolderUid).toBe("p1");
      expect(s.dancePrivate!.p1.hand).toContain("POLICE_CHIEF-0");
      expect(JSON.stringify(s.public.dance!.events)).not.toContain(
        "CRIMINAL-0",
      );
    },
  );
  it.each([true, false])(
    "fixed target follows terminal criminal, initial holder = %s",
    (initiallyTarget) => {
      let s = mark(
        policeFixture([
          ["POLICE_CHIEF-0"],
          ["TRADE-0", initiallyTarget ? "CRIMINAL-0" : "ALIBI-0"],
          [initiallyTarget ? "ALIBI-0" : "CRIMINAL-0"],
        ]),
      );
      s = act(s, { type: "dancePlay", cardId: "TRADE-0" });
      s = act(s, { type: "danceTarget", target: "p2" });
      s = act(
        s,
        {
          type: "danceSelect",
          cardId: initiallyTarget ? "CRIMINAL-0" : "ALIBI-0",
        },
        "p1",
      );
      s = act(
        s,
        {
          type: "danceSelect",
          cardId: initiallyTarget ? "ALIBI-0" : "CRIMINAL-0",
        },
        "p2",
      );
      s = act(s, { type: "danceAcknowledge" });
      expect(s.public.dance!.policeChiefTargetUid).toBe("p1");
      if (!initiallyTarget)
        s = act(s, { type: "dancePlay", cardId: "ALIBI-0" });
      s = act(s, { type: "dancePlay", cardId: "CRIMINAL-0" });
      expect(s.public.dance!.result?.resolution).toBe(
        initiallyTarget ? "CRIMINAL" : "POLICE_CHIEF",
      );
      expect(s.secret.dance!.terminal?.finalCriminalUid).toBe(
        initiallyTarget ? "p2" : "p1",
      );
      if (!initiallyTarget) {
        expect(s.public.dance!.result?.awards).toEqual({ p0: 3, p1: 0, p2: 1 });
        expect(s.public.dance!.events.at(-1)?.text).toContain("警部");
      }
      expect(JSON.stringify(s.public)).not.toContain("finalCriminalHadAlibi");
      s = act(s, { type: "danceNext" }, "p0");
      expect(s.public.dance!.policeChiefTargetUid).toBeUndefined();
      expect(s.secret.dance!.terminal).toBeUndefined();
    },
  );
  it("overrides detective scoring at terminal snapshot, not at placement", () => {
    let s = mark(
      policeFixture([
        ["POLICE_CHIEF-0"],
        ["CRIMINAL-0", "ALIBI-0"],
        ["DETECTIVE-0"],
      ]),
    );
    s = act(s, { type: "dancePlay", cardId: "ALIBI-0" });
    s = act(s, { type: "dancePlay", cardId: "DETECTIVE-0" });
    s = act(s, { type: "danceTarget", target: "p1" });
    expect(s.public.dance!.result?.resolution).toBe("POLICE_CHIEF");
    expect(s.public.dance!.result?.awards).toEqual({ p0: 3, p1: 0, p2: 1 });
    expect(s.secret.dance!.terminal?.detectiveUid).toBe("p2");
  });
  it("captures dog ending before removing criminal and alibi blocks police override", () => {
    let s = policeFixture([
      ["DOG-0"],
      ["CRIMINAL-0", "ALIBI-0"],
      ["ORDINARY_PERSON-0"],
    ]);
    s.public.dance!.policeChiefOwnerUid = "p2";
    s.public.dance!.policeChiefTargetUid = "p1";
    s = act(s, { type: "dancePlay", cardId: "DOG-0" });
    s = act(s, { type: "danceTarget", target: "p1" });
    expect(s.secret.dance!.terminal).toMatchObject({
      finalCriminalUid: "p1",
      finalCriminalHadAlibi: true,
      endReason: "DOG_CAUGHT",
      dogUid: "p0",
    });
    expect(s.public.dance!.result?.resolution).toBe("DOG");
    expect(s.public.dance!.result?.awards).toEqual({ p0: 3, p1: 0, p2: 1 });
  });
  it("active accomplices receive zero after successful police interception", () => {
    let s = mark(
      policeFixture([
        ["POLICE_CHIEF-0"],
        ["CRIMINAL-0"],
        ["ORDINARY_PERSON-0"],
      ]),
    );
    s.public.dance!.players.p2.accomplice = true;
    s = act(s, { type: "dancePlay", cardId: "CRIMINAL-0" });
    expect(s.public.dance!.result?.awards).toEqual({ p0: 3, p1: 0, p2: 0 });
  });
});
