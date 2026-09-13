import { describe, expect, it } from "vitest";
import {
  applyMafiaAction,
  finishMafia,
  mafiaWinners,
  startMafia,
  validateMafiaConfig,
} from "../functions/src/mafia/engine";
import {
  DEFAULT_MAFIA_CONFIG,
  mafiaSetup,
  normalizeMafia,
  rightNeighbor,
} from "../functions/src/shared/mafia";
import type { MafiaAction, MafiaRole } from "../functions/src/shared/mafia";
import type { Session } from "../functions/src/shared/model";
import { leaveSeat } from "../functions/src/membership";
function session(n = 6, cleaner = false) {
  const s: Session = {
    public: {
      code: "ABCDEF",
      gameId: "mafia-de-cuba",
      hostId: "p0",
      status: "waiting",
      createdAt: 0,
      players: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `p${i}`,
          { uid: `p${i}`, nickname: `Player ${i}`, joinedAt: i, ready: true },
        ]),
      ),
      mafiaConfig: { ...DEFAULT_MAFIA_CONFIG, cleanerEnabled: cleaner },
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startMafia(s, "game", (a) => a);
  return s;
}
function act(s: Session, uid: string, a: MafiaAction, now = 1000) {
  const copy = structuredClone(s);
  return applyMafiaAction(copy, uid, a, now);
}
function prepared(n = 6, cleaner = false) {
  return act(session(n, cleaner), "p0", { type: "mafiaPrepare", hidden: 3 });
}
function investigation(
  roles: Array<[MafiaRole, number]>,
  cleaner = false,
  jokers = 0,
) {
  const s = session(roles.length + 1, cleaner),
    g = s.public.mafia!,
    sec = s.secret.mafia!;
  g.phase = "INVESTIGATION";
  g.jokers = jokers;
  sec.initialDiamonds = 15;
  roles.forEach(([role, diamonds], i) => {
    sec.roles[`p${i + 1}`] = { role, diamonds };
    s.mafiaPrivate![`p${i + 1}`] = { gameId: g.id, role, diamonds };
  });
  sec.box.diamonds = 15 - roles.reduce((sum, [, n]) => sum + n, 0);
  return s;
}
function accuse(s: Session, target: string, choice?: "SHOOT" | "PASS") {
  s = act(s, "p0", { type: "mafiaAccuse", target });
  if (choice) {
    const uid = s.public.mafia!.order.find(
      (id) => s.secret.mafia!.roles[id]?.role === "CLEANER",
    )!;
    s = act(s, uid, { type: "mafiaCleaner", choice }, 1100);
  }
  return act(s, "p0", { type: "mafiaResolve" }, 10000);
}
describe("Mafia setup and trusted choices", () => {
  it.each([
    [6, 3, 0],
    [7, 4, 0],
    [8, 5, 1],
    [9, 6, 1],
    [10, 7, 1],
    [11, 8, 2],
    [12, 9, 2],
  ])("%i player component counts", (n, t, j) => {
    const a = mafiaSetup(n);
    expect(a.tokens).toHaveLength(t);
    expect(a.jokers).toBe(j);
    expect(a.diamonds).toBe(15);
    expect(new Set(a.tokens.map((x) => x.id)).size).toBe(t);
  });
  it.each([5, 13])("rejects unsupported %i players", (n) =>
    expect(() => session(n)).toThrow(),
  );
  it("replaces one henchman with cleaner", () => {
    const plain = mafiaSetup(12),
      advanced = mafiaSetup(12, true);
    expect(advanced.tokens).toHaveLength(plain.tokens.length);
    expect(advanced.tokens.filter((t) => t.role === "CLEANER")).toHaveLength(1);
    expect(
      advanced.tokens.filter((t) => t.role === "LOYAL_HENCHMAN"),
    ).toHaveLength(4);
  });
  it("rejects unsupported config", () =>
    expect(() =>
      validateMafiaConfig({
        ...DEFAULT_MAFIA_CONFIG,
        expansion: "REVOLUCION",
      } as never),
    ).toThrow());
  it("uses stable original seats when another godfather is chosen", () => {
    const s = session();
    s.public.status = "waiting";
    s.public.mafiaConfig!.godfatherId = "p3";
    startMafia(s, "next", (a) => a);
    expect(s.public.mafia!.passOrder).toEqual(["p4", "p5", "p0", "p1", "p2"]);
    expect(rightNeighbor(s.public.mafia!.order, "p5")).toBe("p0");
  });
  it("supports random godfather without shuffling seats", () => {
    const s = session();
    s.public.status = "waiting";
    s.public.mafiaConfig!.godfatherSelection = "RANDOM";
    startMafia(s, "next", (a) => [...a].reverse());
    expect(s.public.mafia!.godfatherId).toBe("p5");
    expect(s.public.mafia!.order[0]).toBe("p0");
  });
  it("requires every human ready and accepts ready AI seats", () => {
    const s = session();
    s.public.status = "waiting";
    s.public.players.p1.isBot = true;
    s.public.players.p0.ready = false;
    expect(() => startMafia(s, "next", (a) => a)).toThrow();
    s.public.players.p0.ready = true;
    expect(() => startMafia(s, "next", (a) => a)).not.toThrow();
  });
  it.each([-1, 6, 1.5, NaN])("rejects invalid hidden count %s", (hidden) =>
    expect(() =>
      act(session(), "p0", { type: "mafiaPrepare", hidden }),
    ).toThrow(),
  );
  it("hides preparation and current contents from godfather and public", () => {
    const s = prepared();
    expect(s.secret.mafia!.box.diamonds).toBe(12);
    expect(s.mafiaPrivate!.p0.currentBoxView).toBeUndefined();
    expect(s.mafiaPrivate!.p1.currentBoxView?.diamonds).toBe(12);
    expect(JSON.stringify(s.public)).not.toMatch(
      /hiddenDiamonds|initialDiamonds|currentBoxView|token-0/,
    );
  });
  it("denies wrong player and wrong phase", () => {
    expect(() =>
      act(session(), "p1", { type: "mafiaPrepare", hidden: 0 }),
    ).toThrow();
    expect(() =>
      act(prepared(), "p2", { type: "mafiaTake", diamonds: 1 }),
    ).toThrow();
    expect(() =>
      act(prepared(), "p0", { type: "mafiaAccuse", target: "p1" }),
    ).toThrow();
  });
  it("atomically discards then takes, clearing the previous view", () => {
    let s = prepared();
    s = act(s, "p1", {
      type: "mafiaTake",
      discardTokenId: "token-1",
      tokenId: "token-0",
    });
    expect(s.secret.mafia!.discarded?.role).toBe("AGENT_FBI");
    expect(s.mafiaPrivate!.p1.role).toBe("LOYAL_HENCHMAN");
    expect(s.mafiaPrivate!.p1.currentBoxView).toBeUndefined();
    expect(
      s.mafiaPrivate!.p2.currentBoxView?.tokens.map((t) => t.role),
    ).toEqual(["DRIVER"]);
    expect(JSON.stringify(s.public)).not.toContain("discard");
  });
  it("does not allow discarding and taking the same token", () =>
    expect(() =>
      act(prepared(), "p1", {
        type: "mafiaTake",
        discardTokenId: "token-0",
        tokenId: "token-0",
      }),
    ).toThrow());
  it("only first player may discard", () => {
    const s = act(prepared(), "p1", { type: "mafiaTake", diamonds: 1 });
    expect(() =>
      act(s, "p2", {
        type: "mafiaTake",
        discardTokenId: "token-0",
        diamonds: 1,
      }),
    ).toThrow();
  });
  it.each([
    { diamonds: 0 },
    { diamonds: -1 },
    { diamonds: 13 },
    { diamonds: 1.5 },
    { diamonds: 1, tokenId: "token-0" },
    { tokenId: "fake" },
    { nothing: true },
    { diamonds: "2" },
    {},
  ])("rejects malformed/illegal take %j", (choice) =>
    expect(() =>
      act(prepared(), "p1", { type: "mafiaTake", ...choice } as MafiaAction),
    ).toThrow(),
  );
  it("last player may leave nonempty box, previous holder cannot repeat", () => {
    let s = prepared();
    for (let i = 1; i <= 4; i++)
      s = act(s, `p${i}`, { type: "mafiaTake", diamonds: 1 });
    expect(() => act(s, "p4", { type: "mafiaTake", diamonds: 1 })).toThrow();
    s = act(s, "p5", { type: "mafiaTake", nothing: true });
    expect(s.mafiaPrivate!.p5.role).toBe("STREET_URCHIN");
    expect(s.public.mafia!.phase).toBe("INVESTIGATION");
    expect(s.mafiaPrivate!.p0.missing).toBe(4);
    expect(s.mafiaPrivate!.p0.currentBoxView?.diamonds).toBe(8);
  });
  it("empty box assigns street urchin on neutral pass without skipping holders", () => {
    let s = prepared();
    s = act(s, "p1", { type: "mafiaTake", diamonds: 12 });
    for (let i = 2; i <= 4; i++)
      s = act(s, `p${i}`, { type: "mafiaTake", tokenId: `token-${i - 2}` });
    expect(s.public.mafia!.holderId).toBe("p5");
    s = act(s, "p5", { type: "mafiaTake", nothing: true });
    expect(s.mafiaPrivate!.p5.role).toBe("STREET_URCHIN");
  });
  it("zero stolen diamonds finishes immediately", () => {
    let s = prepared();
    for (let i = 1; i <= 5; i++) {
      s.secret.mafia!.box.tokens.push({ id: `extra${i}`, role: "DRIVER" });
      s = act(s, `p${i}`, { type: "mafiaTake", tokenId: `extra${i}` });
    }
    expect(s.public.mafia!.winReason).toBe("DIAMONDS_RECOVERED");
    expect(s.mafiaPrivate!.p0.currentBoxView).toBeUndefined();
  });
  it("normalizes RTDB empty arrays", () => {
    const s = session();
    delete (s.public.mafia as Partial<NonNullable<Session["public"]["mafia"]>>)
      .history;
    normalizeMafia(s.public.mafia!);
    expect(s.public.mafia!.history).toEqual([]);
  });
});
describe("Investigation and winners", () => {
  const lineup: Array<[MafiaRole, number]> = [
    ["THIEF", 3],
    ["THIEF", 3],
    ["LOYAL_HENCHMAN", 0],
    ["AGENT_FBI", 0],
    ["STREET_URCHIN", 0],
  ];
  it("recovers thieves and wins only after all stolen diamonds return", () => {
    let s = accuse(investigation(lineup), "p1");
    expect(s.public.mafia!.recovered).toBe(3);
    expect(s.public.mafia!.phase).toBe("INVESTIGATION");
    expect(s.public.mafia!.seats.p1.alive).toBe(false);
    s = accuse(s, "p2");
    expect(s.public.mafia!.winners).toEqual(["p0", "p3"]);
    expect(s.public.mafia!.final?.roles.p2.diamonds).toBe(3);
  });
  it("pays joker without elimination, then loses on the next false accusation", () => {
    let s = accuse(investigation(lineup, false, 1), "p3");
    expect(s.public.mafia!.jokers).toBe(0);
    expect(s.public.mafia!.seats.p3.alive).toBe(true);
    expect(() => act(s, "p0", { type: "mafiaAccuse", target: "p3" })).toThrow();
    s = accuse(s, "p5");
    expect(s.public.mafia!.winReason).toBe("GODFATHER_ELIMINATED");
    expect(s.public.mafia!.winners).toEqual(["p1", "p2", "p5"]);
  });
  it("agent alone wins even if jokers remain", () => {
    const s = accuse(investigation(lineup, false, 2), "p4");
    expect(s.public.mafia!.winners).toEqual(["p4"]);
    expect(s.public.mafia!.jokers).toBe(2);
  });
  it("caught thieves cannot win and largest living count wins", () => {
    const s = investigation([
      ["THIEF", 5],
      ["THIEF", 2],
      ["THIEF", 1],
      ["STREET_URCHIN", 0],
      ["DRIVER", 0],
    ]);
    s.public.mafia!.seats.p1.alive = false;
    expect(mafiaWinners(s, "GODFATHER_ELIMINATED")).toEqual(["p2", "p4"]);
  });
  it("resolves driver chains with original seats, not surviving seats", () => {
    const s = investigation([
      ["DRIVER", 0],
      ["DRIVER", 0],
      ["THIEF", 4],
      ["THIEF", 2],
      ["STREET_URCHIN", 0],
    ]);
    expect(mafiaWinners(s, "GODFATHER_ELIMINATED")).toEqual([
      "p3",
      "p5",
      "p2",
      "p1",
    ]);
    s.public.mafia!.seats.p2.alive = false;
    expect(mafiaWinners(s, "GODFATHER_ELIMINATED")).toEqual(["p3", "p5"]);
    expect(mafiaWinners(s, "AGENT_ACCUSED", "p3")).toEqual(["p3"]);
  });
  it("keeps accusation concealed until deadline", () => {
    const s = act(investigation(lineup), "p0", {
      type: "mafiaAccuse",
      target: "p1",
    });
    expect(s.public.mafia!.seats.p1.role).toBeUndefined();
    expect(() => act(s, "p0", { type: "mafiaResolve" }, 2000)).toThrow();
    expect(() => act(s, "p0", { type: "mafiaAccuse", target: "p2" })).toThrow();
  });
  it("only godfather may accuse eligible targets", () => {
    const s = investigation(lineup);
    expect(() => act(s, "p1", { type: "mafiaAccuse", target: "p2" })).toThrow();
    expect(() => act(s, "p0", { type: "mafiaAccuse", target: "p0" })).toThrow();
    expect(() =>
      act(s, "p0", { type: "mafiaAccuse", target: "unknown" }),
    ).toThrow();
  });
  it("leaving aborts and clears all box views, retains seat order", () => {
    const s = prepared(),
      order = [...s.public.mafia!.order];
    leaveSeat(s, "p1");
    expect(s.public.status).toBe("finished");
    expect(s.public.mafia!.winReason).toBe("ABORTED");
    expect(s.public.mafia!.order).toEqual(order);
    expect(s.mafiaPrivate!.p1).toBeUndefined();
    expect(Object.values(s.mafiaPrivate!).every((p) => !p.currentBoxView)).toBe(
      true,
    );
    expect(s.public.mafia!.final).toBeUndefined();
  });
});
describe("Cleaner private fixed window", () => {
  const lineup: Array<[MafiaRole, number]> = [
    ["CLEANER", 0],
    ["AGENT_FBI", 0],
    ["THIEF", 4],
    ["LOYAL_HENCHMAN", 0],
    ["STREET_URCHIN", 0],
  ];
  it("shooting agent is cleaner solo win", () => {
    const s = accuse(investigation(lineup, true), "p2", "SHOOT");
    expect(s.public.mafia!.winners).toEqual(["p1"]);
    expect(s.public.mafia!.winReason).toBe("CLEANER_SHOT_AGENT");
  });
  it("shooting innocent eliminates both without consuming joker", () => {
    const s = accuse(investigation(lineup, true, 1), "p4", "SHOOT");
    expect(s.public.mafia!.seats.p1.alive).toBe(false);
    expect(s.public.mafia!.seats.p4.alive).toBe(false);
    expect(s.public.mafia!.jokers).toBe(1);
    expect(s.public.mafia!.phase).toBe("INVESTIGATION");
  });
  it("shooting final thief recovers diamonds but dead cleaner cannot win", () => {
    const s = accuse(investigation(lineup, true), "p3", "SHOOT");
    expect(s.public.mafia!.winners).toEqual(["p0", "p4"]);
  });
  it("no cleaner choice auto-passes; pass preserves agent win", () => {
    expect(
      accuse(investigation(lineup, true), "p2").public.mafia!.winners,
    ).toEqual(["p2"]);
    expect(
      accuse(investigation(lineup, true), "p2", "PASS").public.mafia!.winners,
    ).toEqual(["p2"]);
  });
  it("choice never changes public payload or deadline", () => {
    const s = act(investigation(lineup, true), "p0", {
        type: "mafiaAccuse",
        target: "p2",
      }),
      before = structuredClone(s.public);
    const chosen = act(
      s,
      "p1",
      { type: "mafiaCleaner", choice: "SHOOT" },
      1100,
    );
    expect(chosen.public).toEqual(before);
    expect(() =>
      act(chosen, "p1", { type: "mafiaCleaner", choice: "PASS" }, 1200),
    ).toThrow();
    expect(() =>
      act(s, "p3", { type: "mafiaCleaner", choice: "SHOOT" }, 1100),
    ).toThrow();
    expect(() =>
      act(s, "p1", { type: "mafiaCleaner", choice: "SHOOT" }, 10000),
    ).toThrow();
  });
  it("window identical if cleaner is not owned", () => {
    const s = investigation(lineup, true);
    s.secret.mafia!.roles.p1.role = "LOYAL_HENCHMAN";
    s.mafiaPrivate!.p1.role = "LOYAL_HENCHMAN";
    const a = act(s, "p0", { type: "mafiaAccuse", target: "p2" }),
      b = act(investigation(lineup, true), "p0", {
        type: "mafiaAccuse",
        target: "p2",
      });
    expect(a.public.mafia!.pending).toEqual(b.public.mafia!.pending);
  });
  it("finished game rejects all later actions", () => {
    const s = investigation(lineup);
    finishMafia(s, "AGENT_ACCUSED", "p2");
    expect(() => act(s, "p0", { type: "mafiaAccuse", target: "p3" })).toThrow();
  });
});
