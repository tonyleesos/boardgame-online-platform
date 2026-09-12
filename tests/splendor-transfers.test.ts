import { describe, expect, it } from "vitest";
import { describeTransfer } from "../client/src/games/splendor/splendorTransfers";
import { startSplendorGame } from "../functions/src/splendor/engine";
import {
  DEMO_CARDS,
  DEMO_ORIENT_CARDS,
} from "../functions/src/shared/splendor";
import type { Session } from "../functions/src/shared/model";

function setup() {
  const session: Session = {
    public: {
      code: "ABCDEF",
      gameId: "splendor",
      hostId: "p0",
      status: "waiting",
      createdAt: 0,
      players: Object.fromEntries(
        [0, 1].map((i) => [
          `p${i}`,
          { uid: `p${i}`, nickname: `玩家${i}`, joinedAt: i, ready: true },
        ]),
      ),
      splendorConfig: { module: "base", competitorMode: false },
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startSplendorGame(session, "animation-test", (values) => values);
  const game = session.public.splendor!;
  return { game, player: game.players.p0 };
}
describe("Splendor acquisition feedback", () => {
  it("flies each selected gem to its own inventory color", () => {
    const { game, player } = setup();
    const plan = describeTransfer(
      { type: "splendorTake", colors: ["white", "blue", "black"] },
      game,
      player,
    )!;
    expect(plan.items.map((x) => [x.color, x.destination])).toEqual([
      ["white", "token:white"],
      ["blue", "token:blue"],
      ["black", "token:black"],
    ]);
  });
  it("represents a double take as two pieces, not one", () => {
    const { game, player } = setup();
    const plan = describeTransfer(
      { type: "splendorDouble", color: "red" },
      game,
      player,
    )!;
    expect(plan.items.map((x) => x.color)).toEqual(["red", "red"]);
    expect(plan.detail).toContain("×2");
  });
  it.each([0, 1])(
    "only shows reservation gold when the bank has it (%i)",
    (gold) => {
      const { game, player } = setup();
      game.bank.gold = gold;
      const plan = describeTransfer(
        { type: "splendorReserve", cardId: DEMO_CARDS[0].id },
        game,
        player,
      )!;
      expect(plan.items.filter((x) => x.color === "gold")).toHaveLength(gold);
      expect(plan.detail.includes("黃金 +1")).toBe(gold > 0);
      expect(plan.items[0].destination).toBe("reserves");
    },
  );
  it("shows a tier-matched card back for a blind reserve without exposing its identity", () => {
    const { game, player } = setup();
    const plan = describeTransfer(
      { type: "splendorBlind", source: "orient", tier: 3 },
      game,
      player,
    )!;
    expect(plan.items[0]).toMatchObject({
      source: "deck:orient3",
      destination: "reserves",
      tier: 3,
    });
    expect(plan.items[0].cardId).toBeUndefined();
  });
  it("uses the privately selected card when buying a private reserved slot", () => {
    const { game, player } = setup();
    player.reservedCards.push({
      slot: "secret",
      tier: 1,
      source: "base",
      visibility: "private",
    });
    const card = DEMO_CARDS[0];
    const plan = describeTransfer(
      { type: "splendorBuy", slot: "secret" },
      game,
      player,
      card.id,
    )!;
    expect(plan.items[0]).toMatchObject({
      cardId: card.id,
      destination: "cards",
    });
    expect(plan.detail).toContain(card.name);
  });
  it("includes an Orient bonus reservation without inventing a gold reward", () => {
    const { game, player } = setup();
    const card = DEMO_ORIENT_CARDS.find(
      (c) => c.orientEffect?.type === "reserve",
    )!;
    const plan = describeTransfer(
      {
        type: "splendorBuy",
        cardId: card.id,
        choice: { reserveCardId: DEMO_CARDS[0].id },
      },
      game,
      player,
    )!;
    expect(plan.items.map((x) => x.destination)).toEqual(["cards", "reserves"]);
    expect(plan.items.some((x) => x.color === "gold")).toBe(false);
  });
  it("does not invent an acquisition for returning tokens or skipping", () => {
    const { game, player } = setup();
    expect(
      describeTransfer(
        { type: "splendorReturn", tokens: { red: 1 } },
        game,
        player,
      ),
    ).toBeNull();
    expect(describeTransfer({ type: "splendorSkip" }, game, player)).toBeNull();
  });
});
