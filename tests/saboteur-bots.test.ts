import { describe, expect, it } from "vitest";
import { startMine, applyMineAction } from "../functions/src/saboteur/engine";
import { chooseMineAction } from "../functions/src/saboteur/bot";
import {
  mineAllegiances,
  mineRoutes,
} from "../functions/src/saboteur/strategy";
import {
  MINE_CARDS,
  type DwarfRole,
  type ActionKind,
} from "../functions/src/shared/saboteur";
import type { Session } from "../functions/src/shared/model";

const identity = <T>(v: T[]) => [...v];
const actionCard = (kind: ActionKind) =>
  MINE_CARDS.find((c) => c.kind === "action" && c.action === kind)!.id;
const pathCard = (name: string) =>
  MINE_CARDS.find((c) => c.kind === "path" && c.name === name)!.id;
function setup(role: DwarfRole, hand: string[]) {
  const s: Session = {
    public: {
      code: "MINE22",
      gameId: "saboteur-2",
      hostId: "p0",
      status: "waiting",
      createdAt: 0,
      players: Object.fromEntries(
        [0, 1, 2].map((i) => [
          `p${i}`,
          { uid: `p${i}`, nickname: `Player ${i}`, ready: true, joinedAt: i },
        ]),
      ),
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startMine(s, "bot-regression", identity);
  const g = s.public.saboteur!,
    own = s.saboteurPrivate!.p0;
  own.role = role;
  own.hand = hand;
  g.players.p0.handCount = hand.length;
  return { s, g, own };
}

describe.each([false, true])(
  "Saboteur AI follows its role (casual=%s)",
  (casual) => {
    const choose = (s: Session) =>
      chooseMineAction(
        "p0",
        s.public.saboteur!,
        s.saboteurPrivate!.p0,
        identity,
        casual,
      )!;
    it("exchanges helpful roads instead of digging toward treasure as a saboteur", () => {
      const { s } = setup("SABOTEUR", ["path-0", "path-1"]);
      expect(choose(s).type).toBe("minePass");
    });
    it("blocks the leading tunnel instead of extending it", () => {
      const dead = pathCard("封閉支道"),
        { s } = setup("SABOTEUR", ["path-0", dead]);
      expect(choose(s)).toMatchObject({
        type: "minePath",
        cardId: dead,
        x: 1,
        y: 0,
        rotation: 0,
      });
    });
    it("never supplies the final link to treasure", () => {
      const { s, g, own } = setup("SABOTEUR", ["path-6"]);
      for (let x = 1; x <= 6; x++)
        g.board[`${x}_0`] = {
          x,
          y: 0,
          type: "path",
          cardId: `path-${x - 1}`,
          rotation: 0,
        };
      own.goals = { "8_0": "GOLD" };
      expect(choose(s).type).toBe("minePass");
    });
    it("uses rockfall to sever a useful route", () => {
      const { s, g } = setup("SABOTEUR", [actionCard("ROCKFALL")]);
      g.board["1_0"] = {
        x: 1,
        y: 0,
        type: "path",
        cardId: "path-0",
        rotation: 0,
      };
      expect(choose(s)).toMatchObject({ type: "mineAction", cell: "1_0" });
    });
    it("does not clear its own blockade with rockfall", () => {
      const { s, g } = setup("SABOTEUR", [actionCard("ROCKFALL")]);
      g.board["1_0"] = {
        x: 1,
        y: 0,
        type: "path",
        cardId: pathCard("封閉支道"),
        rotation: 0,
      };
      expect(choose(s).type).toBe("minePass");
    });
    it("diggers clear a blockade and preserve useful roads", () => {
      const { s, g } = setup("BLUE_DIGGER", [actionCard("ROCKFALL")]);
      g.board["1_0"] = {
        x: 1,
        y: 0,
        type: "path",
        cardId: pathCard("封閉支道"),
        rotation: 0,
      };
      expect(choose(s)).toMatchObject({ type: "mineAction", cell: "1_0" });
      g.board["1_0"].cardId = "path-0";
      expect(choose(s).type).toBe("minePass");
    });
    it.each(["BLUE_DIGGER", "GREEN_DIGGER", "BOSS"] as DwarfRole[])(
      "%s builds forward, never plays a blocker",
      (role) => {
        const { s } = setup(role, [pathCard("封閉支道"), "path-0"]);
        expect(choose(s)).toMatchObject({
          type: "minePath",
          cardId: "path-0",
          x: 1,
          y: 0,
        });
      },
    );
    it("does not repair a known enemy or sabotage a known ally", () => {
      const { s, g, own } = setup("SABOTEUR", [
        actionCard("REPAIR"),
        actionCard("BREAK"),
      ]);
      own.inspections = [
        { uid: "p1", role: "BLUE_DIGGER", revision: 0 },
        { uid: "p2", role: "SABOTEUR", revision: 0 },
      ];
      g.players.p1.effects.PICKAXE = {
        cardId: actionCard("BREAK"),
        sequence: 0,
      };
      expect(choose(s).type).toBe("minePass");
      delete g.players.p1.effects.PICKAXE;
      expect(choose(s)).toMatchObject({
        type: "mineAction",
        target: "p1",
        cardId: actionCard("BREAK"),
      });
    });
    it("repairs an inspected teammate instead of an unknown player", () => {
      const { s, g, own } = setup("BLUE_DIGGER", [actionCard("REPAIR")]);
      for (const id of ["p1", "p2"])
        g.players[id].effects.PICKAXE = {
          cardId: actionCard("BREAK"),
          sequence: 0,
        };
      own.inspections = [{ uid: "p2", role: "GREEN_DIGGER", revision: 0 }];
      expect(choose(s)).toMatchObject({ type: "mineAction", target: "p2" });
    });
    it("reacts to publicly observed obstruction without reading hidden identities", () => {
      const { s, g } = setup("BLUE_DIGGER", [actionCard("BREAK")]);
      const cardId = pathCard("封閉支道");
      g.board["1_0"] = { x: 1, y: 0, cardId, type: "path", rotation: 0 };
      g.activities = [
        {
          uid: "p2",
          revision: 1,
          kind: "minePath",
          text: "placed",
          cell: "1_0",
          cardId,
        },
      ];
      expect(choose(s)).toMatchObject({ type: "mineAction", target: "p2" });
    });
    it("discards obsolete inspection knowledge after changing hats", () => {
      const { s, g, own } = setup("BLUE_DIGGER", [actionCard("BREAK")]);
      own.inspections = [{ uid: "p1", role: "SABOTEUR", revision: 1 }];
      g.activities = [
        {
          uid: "p2",
          target: "p1",
          revision: 2,
          kind: "CHANGE_HATS",
          text: "changed",
        },
      ];
      expect(choose(s).type).toBe("minePass");
      // Still unknown once the change falls out of the 40-entry event history.
      g.activities = [
        { uid: "p2", revision: 50, kind: "minePass", text: "passed" },
      ];
      expect(choose(s).type).toBe("minePass");
    });
    it("geologists favor crystals", () => {
      const crystal = MINE_CARDS.find(
        (c) => c.kind === "path" && c.crystalCount === 2,
      )!;
      const { s } = setup("GEOLOGIST", ["path-0", crystal.id]);
      expect(choose(s)).toMatchObject({ type: "minePath", cardId: crystal.id });
    });
    it("will not place an opposing colored door", () => {
      const { s } = setup("BLUE_DIGGER", [pathCard("綠色門")]);
      expect(choose(s).type).toBe("minePass");
    });
    it("does not reveal gold for a team it cannot join", () => {
      const { s, g, own } = setup("BLUE_DIGGER", ["path-7"]);
      for (let x = 1; x <= 6; x++)
        g.board[`${x}_0`] = {
          x,
          y: 0,
          type: "path",
          cardId: x === 1 ? pathCard("綠色門") : `path-${x}`,
          rotation: 0,
        };
      own.goals = { "8_0": "GOLD" };
      const a = choose(s);
      expect(a).not.toMatchObject({ type: "minePath", x: 7, y: 0 });
    });
    it("all chosen hand-card actions pass authoritative engine validation", () => {
      for (const role of [
        "SABOTEUR",
        "BLUE_DIGGER",
        "GEOLOGIST",
      ] as DwarfRole[]) {
        const { s } = setup(role, [
          "path-0",
          pathCard("封閉支道"),
          actionCard("MAP"),
          actionCard("REPAIR"),
        ]);
        expect(() =>
          applyMineAction(s, "p0", choose(s), identity),
        ).not.toThrow();
      }
    });
  },
);

it("inspection is stronger than behavioral guesses and role swaps reset guesses", () => {
  const { g, own } = setup("BLUE_DIGGER", []);
  const cardId = pathCard("封閉支道");
  g.board["1_0"] = { x: 1, y: 0, type: "path", cardId, rotation: 0 };
  g.activities = [
    {
      uid: "p1",
      kind: "minePath",
      cell: "1_0",
      cardId,
      revision: 1,
      text: "placed",
    },
  ];
  own.inspections = [{ uid: "p1", role: "BOSS", revision: 2 }];
  expect(mineAllegiances(g, own).beliefs.get("p1")).toBe(1);
  g.activities.push({
    uid: "p2",
    kind: "CHANGE_HATS",
    target: "p1",
    revision: 3,
    text: "changed",
  });
  expect(mineAllegiances(g, own).beliefs.get("p1")).toBe(0);
});

it("evaluates separate bridge channels rather than assuming all ports connect", () => {
  const { s, g, own } = setup("SABOTEUR", [pathCard("跨越橋梁")]);
  // Enter a bridge from the north: its east-west passage is not connected.
  g.board["1_0"] = {
    x: 1,
    y: 0,
    type: "path",
    cardId: pathCard("彎曲礦道"),
    rotation: 0,
  };
  g.board["1_1"] = {
    x: 1,
    y: 1,
    type: "path",
    cardId: pathCard("跨越橋梁"),
    rotation: 0,
  };
  own.goals = { "8_0": "GOLD" };
  const bridged = mineRoutes(g.board, own).value;
  const before = structuredClone(s);
  chooseMineAction("p0", g, s.saboteurPrivate!.p0, identity);
  expect(s).toEqual(before);
  g.board["1_1"].cardId = pathCard("十字礦道");
  expect(mineRoutes(g.board, own).value).toBeGreaterThan(bridged);
});
