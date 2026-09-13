import { describe, expect, it } from "vitest";
import type { Session } from "../functions/src/shared/model";
import { DEFAULT_MAFIA_CONFIG } from "../functions/src/shared/mafia";
import { applyMafiaAction, startMafia } from "../functions/src/mafia/engine";
import { chooseMafiaAction } from "../functions/src/mafia/bot";
import { advanceOneBot, botToken } from "../functions/src/bots";
function rng(seed: number) {
  return <T>(input: T[]) => {
    const a = [...input];
    for (let i = a.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
}
function practice(n: number, cleaner = false, aiFather = false) {
  const s: Session = {
    public: {
      code: "ABCDEF",
      gameId: "mafia-de-cuba",
      hostId: "p0",
      createdAt: 0,
      status: "waiting",
      mode: "practice",
      mafiaConfig: {
        ...DEFAULT_MAFIA_CONFIG,
        cleanerEnabled: cleaner,
        ...(aiFather ? { godfatherId: "p1" } : {}),
      },
      players: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `p${i}`,
          {
            uid: `p${i}`,
            nickname: `Player ${i}`,
            joinedAt: i,
            ready: true,
            isBot: i > 0,
          },
        ]),
      ),
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startMafia(s, "game", rng(1));
  return s;
}
describe("Mafia AI practice", () => {
  it.each(Array.from({ length: 42 }, (_, i) => i + 1))(
    "finishes seed %i across player counts, seats, difficulty and Cleaner",
    (seed) => {
      const s = practice(6 + (seed % 7), seed % 2 === 0, seed % 3 !== 0),
        shuffle = rng(seed);
      s.public.botLevel = seed % 2 ? "standard" : "casual";
      for (let step = 0; step < 100 && s.public.status === "playing"; step++) {
        const g = s.public.mafia!;
        if (g.phase === "ACCUSATION_PENDING") {
          advanceOneBot(s, shuffle);
          applyMafiaAction(
            s,
            "p0",
            { type: "mafiaResolve" },
            g.pending!.deadline + 1,
          );
        } else if (!advanceOneBot(s, shuffle)) {
          const a = chooseMafiaAction("p0", g, s.mafiaPrivate!.p0, shuffle);
          expect(a).not.toBeNull();
          applyMafiaAction(s, "p0", a!);
        }
      }
      expect(s.public.status).toBe("finished");
      expect(s.public.mafia!.winners.length).toBeGreaterThan(0);
      expect(s.public.mafia!.final).toBeDefined();
    },
  );
  it("policy cannot see actual opponent roles or hidden discard", () => {
    const s = practice(6, false, true),
      g = s.public.mafia!,
      own = s.mafiaPrivate!.p1;
    g.phase = "INVESTIGATION";
    const a = chooseMafiaAction("p1", g, own, rng(88));
    s.secret.mafia!.roles.p2 = { role: "AGENT_FBI", diamonds: 0 };
    s.secret.mafia!.discarded = { id: "secret", role: "DRIVER" };
    expect(chooseMafiaAction("p1", g, own, rng(88))).toEqual(a);
  });
  it("only the holder acts and takes a legal item from its own view", () => {
    const s = practice(6);
    applyMafiaAction(s, "p0", { type: "mafiaPrepare", hidden: 5 });
    const g = s.public.mafia!;
    expect(chooseMafiaAction("p2", g, s.mafiaPrivate!.p2, rng(2))).toBeNull();
    const a = chooseMafiaAction("p1", g, s.mafiaPrivate!.p1, rng(2));
    expect(a?.type).toBe("mafiaTake");
    expect(() => applyMafiaAction(s, "p1", a!)).not.toThrow();
    expect(s.mafiaPrivate!.p1.currentBoxView).toBeUndefined();
  });
  it("public take speech is identical for different private outcomes", () => {
    const messages = new Set<string>(),
      roles = new Set<string>();
    for (let seed = 1; seed < 25; seed++) {
      const s = practice(6);
      applyMafiaAction(s, "p0", { type: "mafiaPrepare", hidden: 0 });
      advanceOneBot(s, rng(seed));
      messages.add(s.public.activity!.at(-1)!.message);
      roles.add(s.mafiaPrivate!.p1.role!);
    }
    expect(messages.size).toBe(1);
    expect(roles.size).toBeGreaterThan(1);
  });
  it("AI cleaner response causes no public mutation or moved signal", () => {
    const s = practice(6, true),
      g = s.public.mafia!;
    g.phase = "ACCUSATION_PENDING";
    g.pending = { target: "p2", deadline: Date.now() + 8000 };
    s.mafiaPrivate!.p1.role = "CLEANER";
    s.secret.mafia!.roles.p1 = { role: "CLEANER", diamonds: 0 };
    const before = structuredClone(s.public);
    expect(advanceOneBot(s, rng(3))).toBe(false);
    expect(s.public).toEqual(before);
    expect(s.mafiaPrivate!.p1.cleanerChoice).toBeDefined();
    expect(botToken(s.public)).toBe("game:0");
    expect(advanceOneBot(s, rng(4))).toBe(false);
  });
  it("AI without a cleaner is indistinguishable in public response", () => {
    const s = practice(6, true);
    s.public.mafia!.phase = "ACCUSATION_PENDING";
    s.public.mafia!.pending = { target: "p2", deadline: Date.now() + 8000 };
    const before = structuredClone(s.public);
    expect(advanceOneBot(s, rng(3))).toBe(false);
    expect(s.public).toEqual(before);
  });
});
