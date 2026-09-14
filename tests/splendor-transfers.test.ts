import { describe, expect, it } from "vitest";
import { describePublicTransfer } from "../client/src/games/splendor/splendorTransfers";
import { nextGemSelection, gemSelectionAction } from "../client/src/games/splendor/splendorGemSelection";
import { startSplendorGame, applySplendorAction } from "../functions/src/splendor/engine";
import { CARD_BY_ID, GEM_COLORS, normalizeSplendor } from "../functions/src/shared/splendor";
import type { GemColor, SplendorAction } from "../functions/src/shared/splendor";
import type { Session } from "../functions/src/shared/model";

function setup() {
  const session: Session = {
    public: {
      code: "ABCDEF", gameId: "splendor", hostId: "p0", status: "waiting", createdAt: 0,
      players: Object.fromEntries([0, 1].map((i) => [`p${i}`,
        { uid: `p${i}`, nickname: `玩家${i}`, joinedAt: i, ready: true }])),
      splendorConfig: { module: "base", competitorMode: false },
    },
    private: {}, secret: { teamVotes: {}, missionVotes: {} },
  };
  startSplendorGame(session, "animation-test", (values) => values);
  return session;
}
describe("direct gem selection", () => {
  it("cycles a stocked color through one, two and zero pieces", () => {
    const game = setup().public.splendor!;
    let selected: GemColor[] = [];
    selected = nextGemSelection(game, selected, "red");
    expect(selected).toEqual(["red"]);
    selected = nextGemSelection(game, selected, "red");
    expect(gemSelectionAction(game, game.players.p0, selected)).toEqual({ type: "splendorDouble", color: "red" });
    expect(nextGemSelection(game, selected, "blue")).toEqual(selected);
    expect(nextGemSelection(game, selected, "red")).toEqual([]);
  });
  it("permits at most three different colors, and removes one selected color", () => {
    const game = setup().public.splendor!;
    let selected: GemColor[] = [];
    for (const color of GEM_COLORS) selected = nextGemSelection(game, selected, color);
    expect(selected).toEqual(GEM_COLORS.slice(0, 3));
    expect(nextGemSelection(game, selected, "blue")).toEqual(["white", "green"]);
    expect(gemSelectionAction(game, game.players.p0, selected)).toEqual({ type: "splendorTake", colors: selected });
    expect(gemSelectionAction(game, game.players.p0, ["white", "white", "blue"])).toBeNull();
  });
  it("rejects exhausted colors, doubles below four, and stale invalid selections", () => {
    const game = setup().public.splendor!;
    game.bank.red = 3; game.bank.blue = 0;
    expect(nextGemSelection(game, [], "blue")).toEqual([]);
    expect(nextGemSelection(game, ["red"], "red")).toEqual([]);
    expect(gemSelectionAction(game, game.players.p0, ["red", "red"])).toBeNull();
    expect(gemSelectionAction(game, game.players.p0, ["blue"])).toBeNull();
    expect(gemSelectionAction(game, game.players.p0, [])).toBeNull();
  });
});
describe("public Splendor action playback", () => {
  it("publishes exact colored tokens for every viewer after acceptance", () => {
    const initial = setup();
    const updated = applySplendorAction(initial, "p0", { type: "splendorTake", colors: ["white", "blue", "black"] });
    const game = updated.public.splendor!, event = game.activities![0];
    expect(initial.public.splendor!.activities).toBeUndefined();
    expect(event).toMatchObject({ uid: "p0", revision: 1, tokens: { white: 1, blue: 1, black: 1 } });
    const plan = describePublicTransfer(event, game);
    expect(plan.title).toContain("玩家0");
    expect(plan.items.map((item) => item.destination)).toEqual(["player:p0:token:white", "player:p0:token:blue", "player:p0:token:black"]);
    const second = applySplendorAction(updated, "p1", { type: "splendorDouble", color: "red" }).public.splendor!;
    expect(second.activities!.map((item) => item.revision)).toEqual([1, 2]);
    expect(describePublicTransfer(second.activities![1], second).items.map((item) => item.color)).toEqual(["red", "red"]);
  });
  it("never publishes a hidden reserve identity or arbitrary action properties", () => {
    const initial = setup();
    const updated = applySplendorAction(initial, "p0", {
      type: "splendorBlind", tier: 3, source: "base", secretMessage: "do not disclose",
    } as SplendorAction);
    const game = updated.public.splendor!, event = game.activities![0];
    const hidden = Object.values(updated.splendorPrivate!.p0.reserved)[0];
    expect(JSON.stringify(event)).not.toContain(hidden);
    expect(JSON.stringify(event)).not.toContain("do not disclose");
    expect(event.cards).toEqual([{ tier: 3, source: "base", from: "deck", to: "reserved" }]);
    const plan = describePublicTransfer(event, game);
    expect(plan.items.find((item) => item.tier)).toMatchObject({ source: "deck:base3", destination: "player:p0:reserves", tier: 3 });
    expect(plan.items.find((item) => item.tier)?.cardId).toBeUndefined();
    expect(event.tokens).toEqual({ gold: 1 });
  });
  it("shows a reserved card's identity only after buying it, with payment going back to the bank", () => {
    let session = applySplendorAction(setup(), "p0", { type: "splendorBlind", tier: 1, source: "base" });
    const [slot, id] = Object.entries(session.splendorPrivate!.p0.reserved)[0];
    session.public.splendor!.currentPlayerIndex = 0;
    session.public.splendor!.players.p0.tokens = { ...CARD_BY_ID[id].cost, gold: 0 };
    session = applySplendorAction(session, "p0", { type: "splendorBuy", slot });
    const game = session.public.splendor!, event = game.activities!.at(-1)!;
    expect(event.cards[0]).toMatchObject({ cardId: id, from: "reserved", to: "purchased" });
    const plan = describePublicTransfer(event, game);
    expect(plan.items.filter((item) => item.color).every((item) => item.destination.startsWith("bank:"))).toBe(true);
    expect(plan.items.find((item) => item.cardId)?.destination).toBe("player:p0:cards");
  });
  it.each([0, 5])("shows reservation gold only if it was actually received (bank %i)", (gold) => {
    const session = setup(), game = session.public.splendor!;
    game.bank.gold = gold;
    const updated = applySplendorAction(session, "p0", { type: "splendorReserve", cardId: game.market.base1[0]! }).public.splendor!;
    expect(updated.activities![0].tokens.gold ?? 0).toBe(gold ? 1 : 0);
    expect(updated.activities![0].cards[0].cardId).toBe(game.market.base1[0]);
  });
  it("records returns and skip actions as public outcomes", () => {
    let session = setup();
    session.public.splendor!.phase = "RETURN_EXCESS_TOKENS";
    session.public.splendor!.players.p0.tokens = { white: 3, blue: 3, green: 3, red: 2, black: 0, gold: 0 };
    session = applySplendorAction(session, "p0", { type: "splendorReturn", tokens: { red: 1 } });
    expect(session.public.splendor!.activities![0].tokens).toEqual({ red: -1 });
    session.public.splendor!.phase = "RESOLVE_EXPANSION";
    session.public.splendor!.config.module = "strongholds";
    session = applySplendorAction(session, "p1", { type: "splendorStronghold" });
    expect(session.public.splendor!.activities![1].text).toContain("略過");
  });
  it("does not record rejected actions and normalizes empty Firebase fields", () => {
    const session = setup();
    expect(() => applySplendorAction(session, "p1", { type: "splendorTake", colors: ["red"] })).toThrow();
    expect(session.public.splendor!.activities).toBeUndefined();
    const game = applySplendorAction(session, "p0", { type: "splendorTake", colors: ["red"] }).public.splendor!;
    const event = game.activities![0];
    delete (event as Partial<typeof event>).cards;
    delete (event as Partial<typeof event>).nobleNames;
    expect(normalizeSplendor(game).activities![0].cards).toEqual([]);
    expect(describePublicTransfer(event, game).items).toHaveLength(1);
  });
  it("animates an opponent's removed stronghold back to its owner", () => {
    const session = setup(), game = session.public.splendor!;
    game.config.module = "strongholds";
    game.phase = "RESOLVE_EXPANSION";
    const cardId = game.market.base1[0]!;
    game.strongholds[cardId] = { ownerUid: "p1", count: 2 };
    const updated = applySplendorAction(session, "p0", { type: "splendorStronghold", cardId, remove: true }).public.splendor!;
    const event = updated.activities![0];
    expect(event.strongholdChange).toEqual({ cardId, ownerUid: "p1", count: 1, removed: true });
    expect(describePublicTransfer(event, updated).items).toContainEqual({ source: `card:${cardId}`, destination: "player:p1:cards", symbol: "stronghold" });
  });
  it("records the purchase and all three returned strongholds before the follow-up phase", () => {
    const session = setup(), game = session.public.splendor!;
    game.config.module = "strongholds";
    const cardId = game.market.base1[0]!;
    game.players.p0.tokens = { ...CARD_BY_ID[cardId].cost, gold: 0 };
    game.strongholds[cardId] = { ownerUid: "p0", count: 3 };
    const updated = applySplendorAction(session, "p0", { type: "splendorBuy", cardId }).public.splendor!;
    expect(updated.phase).toBe("RESOLVE_EXPANSION");
    const event = updated.activities![0];
    expect(event.cards[0].cardId).toBe(cardId);
    expect(describePublicTransfer(event, updated).items.filter((item) => item.symbol === "stronghold")).toHaveLength(3);
  });
});
